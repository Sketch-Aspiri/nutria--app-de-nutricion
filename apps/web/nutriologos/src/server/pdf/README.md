# Verificación visual del plan PDF

Desde `apps/web`, genera el fixture ficticio y estable:

```powershell
npx tsx src/server/pdf/generateFixture.ts
```

Quedan dos archivos en `output/pdf/`: `plan-alimenticio-fixture.pdf` para el caso normal y
`plan-alimenticio-texto-largo-fixture.pdf` para comprobar nombres, items libres y notas extensas.
Para verificar cada página con Poppler:

```powershell
New-Item -ItemType Directory -Force ..\..\tmp\pdfs | Out-Null
pdftoppm -png ..\..\output\pdf\plan-alimenticio-fixture.pdf ..\..\tmp\pdfs\plan
pdfinfo ..\..\output\pdf\plan-alimenticio-fixture.pdf
pdftoppm -png ..\..\output\pdf\plan-alimenticio-texto-largo-fixture.pdf ..\..\tmp\pdfs\plan-largo
```

Revisa las imágenes `tmp/pdfs/plan-*.png`: encabezado, tarjetas de macros, cortes entre comidas,
logo o inicial de respaldo y pie con `Página n de total` deben aparecer completos y sin solapes.
