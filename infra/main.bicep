// Catálogo de agentes en Azure: Container Apps + Blob Storage + identidad administrada + Application Insights.
// Se despliega con `azd up` (la primera vez) y `azd deploy` (después).
targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Nombre del entorno de azd (se usa para nombrar los recursos).')
param environmentName string

@minLength(1)
@description('Región de Azure.')
param location string

@description('Id del usuario que despliega; recibe acceso a los blobs para soporte. Opcional.')
param principalId string = ''

@description('azd lo pone en true cuando la app ya existe, para no reemplazar la imagen al reaprovisionar.')
param webExists bool = false

@description('Client ID del registro de aplicación de Microsoft Entra para entrar al back. Vacío = back cerrado.')
param entraClientId string = ''

@secure()
@description('Secreto del registro de aplicación de Microsoft Entra.')
param entraClientSecret string = ''

@description('Dominios con acceso al back, separados por coma (ej. readymind.com). Vacío = todo el tenant.')
param adminAllowedDomains string = ''

@description('Correos con acceso al back, separados por coma. Opcional.')
param adminAllowedEmails string = ''

@description('Réplicas mínimas. 1 evita el arranque en frío durante un evento; 0 ahorra costo.')
param minReplicas int = 1

@description('Cargar la semilla de agentes si el catálogo está vacío.')
param seedOnEmpty string = 'true'

var tags = { 'azd-env-name': environmentName }
var token = toLower(uniqueString(subscription().id, environmentName, location))

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module recursos 'modules/recursos.bicep' = {
  name: 'recursos'
  scope: rg
  params: {
    location: location
    tags: tags
    token: token
    principalId: principalId
    webExists: webExists
    entraClientId: entraClientId
    entraClientSecret: entraClientSecret
    adminAllowedDomains: adminAllowedDomains
    adminAllowedEmails: adminAllowedEmails
    minReplicas: minReplicas
    seedOnEmpty: seedOnEmpty
  }
}

output AZURE_RESOURCE_GROUP string = rg.name
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = recursos.outputs.registryLoginServer
output AZURE_CONTAINER_REGISTRY_NAME string = recursos.outputs.registryName
output AZURE_STORAGE_ACCOUNT_URL string = recursos.outputs.storageUrl
output SERVICE_WEB_NAME string = recursos.outputs.appName
output SERVICE_WEB_URI string = recursos.outputs.appUri
output ENTRA_REDIRECT_URI string = '${recursos.outputs.appUri}/.auth/login/aad/callback'
