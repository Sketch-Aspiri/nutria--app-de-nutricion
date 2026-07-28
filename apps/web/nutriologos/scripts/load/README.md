# Prueba de carga de lanzamiento

El escenario comprueba el health check y, cuando se proporciona una cookie de
sesión de una cuenta sintética, el listado autorizado de pacientes. No crea ni
modifica expedientes y no imprime datos de salud.

El runner predeterminado usa Node y no requiere dependencias adicionales. Debe
apuntar a una app con base de prueba/preview.

```powershell
$env:LOAD_TEST_URL="http://localhost:3000"
npm.cmd run test:load
```

Para una preview remota hay dos barreras deliberadas:

```powershell
$env:LOAD_TEST_URL="https://preview.example.mx"
$env:LOAD_TEST_ALLOW_REMOTE="true"
$env:LOAD_TEST_SESSION_COOKIE="<cookie de una cuenta sintética>"
npm.cmd run test:load
```

Valores predeterminados: 20 VUs para health, 10 para el panel y 1 minuto. Los
umbrales son menos de 1% de error, p95 menor a 500 ms en health y menor a
1,000 ms en el listado. El escenario equivalente para k6 sigue disponible con
`npm run test:load:k6`. No ejecutar contra producción durante horario de uso.
