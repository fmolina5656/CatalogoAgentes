// Lee la imagen que tiene hoy la Container App (la que publicó `azd deploy`).
// Va en un módulo aparte: leer el mismo recurso que se despliega en la misma plantilla
// es una dependencia circular para ARM.
param exists bool
param name string

resource existente 'Microsoft.App/containerApps@2024-03-01' existing = if (exists) {
  name: name
}

output image string = exists ? existente.properties.template.containers[0].image : ''
