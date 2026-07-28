-- Expand: el objetivo OTRO perdía la intención clínica al guardarse solo como
-- enum. La columna es nullable y aditiva, así que el código viejo (que la
-- ignora) y el nuevo pueden convivir durante el despliegue.
ALTER TABLE "medical_records"
ADD COLUMN "objetivo_otro" TEXT;
