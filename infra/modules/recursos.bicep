param location string
param tags object
param token string
param principalId string
param webExists bool
param entraClientId string
@secure()
param entraClientSecret string
param adminAllowedDomains string
param adminAllowedEmails string
param minReplicas int
param seedOnEmpty string

var appName = 'ca-catalogo-${token}'
var conEntra = !empty(entraClientId)
// Roles integrados de Azure
var acrPull = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var blobDataContributor = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

// ---------- Observabilidad ----------
resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${token}'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-${token}'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logs.id
  }
}

// ---------- Identidad administrada (sin llaves en el código) ----------
resource identidad 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-catalogo-${token}'
  location: location
  tags: tags
}

// ---------- Imágenes de contenedor ----------
resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: 'cr${token}'
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
    anonymousPullEnabled: false
  }
}

resource registryPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: registry
  name: guid(registry.id, identidad.id, acrPull)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPull)
    principalId: identidad.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ---------- Blob Storage: fichas, orden e imágenes ----------
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'st${token}'
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_ZRS' }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false // solo identidad (Entra ID), nada de llaves
    supportsHttpsTrafficOnly: true
    defaultToOAuthAuthentication: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    isVersioningEnabled: true // cada guardado deja una versión recuperable
    deleteRetentionPolicy: { enabled: true, days: 30 }
    containerDeleteRetentionPolicy: { enabled: true, days: 30 }
  }
}

resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'catalogo'
  properties: { publicAccess: 'None' }
}

resource blobApp 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storage
  name: guid(storage.id, identidad.id, blobDataContributor)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', blobDataContributor)
    principalId: identidad.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource blobUsuario 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(principalId)) {
  scope: storage
  name: guid(storage.id, principalId, blobDataContributor)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', blobDataContributor)
    principalId: principalId
    principalType: 'User'
  }
}

// ---------- Container Apps ----------
resource entorno 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-${token}'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

// Si la app ya existe, conserva la imagen que desplegó azd (no la reemplaza por la de ejemplo).
resource appExistente 'Microsoft.App/containerApps@2024-03-01' existing = if (webExists) {
  name: appName
}

var secretos = concat([
  { name: 'appinsights', value: insights.properties.ConnectionString }
], conEntra ? [
  { name: 'microsoft-provider-authentication-secret', value: entraClientSecret }
] : [])

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  tags: union(tags, { 'azd-service-name': 'web' })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identidad.id}': {} }
  }
  properties: {
    managedEnvironmentId: entorno.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        { server: registry.properties.loginServer, identity: identidad.id }
      ]
      secrets: secretos
    }
    template: {
      containers: [
        {
          name: 'web'
          image: webExists ? appExistente.properties.template.containers[0].image : 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'AZURE_STORAGE_ACCOUNT_URL', value: storage.properties.primaryEndpoints.blob }
            { name: 'AZURE_STORAGE_CONTAINER', value: container.name }
            { name: 'AZURE_CLIENT_ID', value: identidad.properties.clientId }
            { name: 'AUTH_MODE', value: 'entra' }
            { name: 'ADMIN_ALLOWED_DOMAINS', value: adminAllowedDomains }
            { name: 'ADMIN_ALLOWED_EMAILS', value: adminAllowedEmails }
            { name: 'SECURE_COOKIES', value: 'true' }
            { name: 'SEED_ON_EMPTY', value: seedOnEmpty }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', secretRef: 'appinsights' }
          ]
          probes: [
            { type: 'Liveness', httpGet: { path: '/api/salud', port: 8000 }, periodSeconds: 30 }
            { type: 'Readiness', httpGet: { path: '/api/salud', port: 8000 }, periodSeconds: 10 }
          ]
        }
      ]
      scale: { minReplicas: minReplicas, maxReplicas: 3 }
    }
  }
  dependsOn: [ registryPull, blobApp ]
}

// Autenticación integrada de Container Apps con Microsoft Entra ID.
// Lo público queda abierto (AllowAnonymous); el backend exige sesión en /api/admin/*.
resource auth 'Microsoft.App/containerApps/authConfigs@2024-03-01' = if (conEntra) {
  parent: app
  name: 'current'
  properties: {
    platform: { enabled: true }
    globalValidation: { unauthenticatedClientAction: 'AllowAnonymous' }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: entraClientId
          clientSecretSettingName: 'microsoft-provider-authentication-secret'
          openIdIssuer: '${environment().authentication.loginEndpoint}${tenant().tenantId}/v2.0'
        }
      }
    }
    login: { preserveUrlFragmentsForLogins: true }
  }
}

output registryLoginServer string = registry.properties.loginServer
output registryName string = registry.name
output storageUrl string = storage.properties.primaryEndpoints.blob
output appName string = app.name
output appUri string = 'https://${app.properties.configuration.ingress.fqdn}'
