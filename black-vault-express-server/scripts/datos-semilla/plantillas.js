// Generadores del contenido de los documentos de demostración (.md y .txt).
// La organización ficticia es "Consultores Asociados Vértice, S.A.", una firma de
// servicios profesionales en Guatemala.

const EMPRESA = 'Consultores Asociados Vértice, S.A.';

const moneda = (n) => `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const plantillas = {
  contrato: ({ cliente, servicio, monto, meses, fecha, firmante }) => `# Contrato de servicios profesionales

**Número:** CSP-${fecha.slice(0, 4)}-${cliente.length * 7}
**Fecha:** ${fecha}

## Partes

1. **${EMPRESA}**, en adelante "LA CONSULTORA", representada por ${firmante}.
2. **${cliente}**, en adelante "EL CLIENTE".

## Objeto

LA CONSULTORA prestará a EL CLIENTE servicios de **${servicio}**, conforme al plan de trabajo anexo.

## Plazo

El contrato tendrá una vigencia de **${meses} meses** contados a partir de su firma, prorrogable por acuerdo escrito de ambas partes.

## Honorarios

| Concepto | Monto |
|---|---|
| Honorarios mensuales | ${moneda(monto)} |
| Total del contrato | ${moneda(monto * meses)} |

Los pagos se realizarán dentro de los primeros diez días de cada mes, contra entrega de factura.

## Cláusulas

1. **Confidencialidad.** Toda la información intercambiada se considera confidencial durante la vigencia del contrato y dos años después.
2. **Propiedad intelectual.** Los entregables pasan a ser propiedad de EL CLIENTE una vez pagados en su totalidad.
3. **Terminación anticipada.** Cualquiera de las partes puede terminar el contrato con 30 días de aviso por escrito.
4. **Jurisdicción.** Para cualquier controversia, las partes se someten a los tribunales de la ciudad de Guatemala.

---

_Firmado en la ciudad de Guatemala._
`,

  acta: ({ titulo, fecha, asistentes, temas, acuerdos }) => `# Acta de reunión: ${titulo}

- **Fecha:** ${fecha}
- **Lugar:** Sala de juntas, ${EMPRESA}
- **Asistentes:** ${asistentes.join(', ')}

## Agenda

${temas.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## Desarrollo

Se revisó cada punto de la agenda. Los participantes expusieron el avance de sus áreas y las dificultades encontradas durante el período.

## Acuerdos

${acuerdos.map((a) => `- [ ] ${a}`).join('\n')}

_Próxima reunión: a convocar por la coordinación._
`,

  informe: ({ titulo, periodo, indicadores, conclusion }) => `# ${titulo}

**Período:** ${periodo}
**Elaborado por:** ${EMPRESA}

## Resumen ejecutivo

Durante ${periodo} se mantuvo la operación dentro de los parámetros esperados. A continuación se presentan los indicadores principales.

## Indicadores

| Indicador | Meta | Resultado |
|---|---:|---:|
${indicadores.map(([nombre, meta, real]) => `| ${nombre} | ${meta} | ${real} |`).join('\n')}

## Conclusiones

${conclusion}

## Recomendaciones

1. Dar seguimiento mensual a los indicadores por debajo de la meta.
2. Documentar las lecciones aprendidas en la próxima reunión de área.
`,

  politica: ({ titulo, area, puntos, version }) => `# ${titulo}

> Área responsable: ${area} · Versión ${version}

## Propósito

Establecer lineamientos claros para el personal de ${EMPRESA}.

## Alcance

Aplica a todos los colaboradores, contratistas y practicantes.

## Lineamientos

${puntos.map((p, i) => `${i + 1}. ${p}`).join('\n')}

## Vigencia

Esta política entra en vigor a partir de su publicación y se revisará anualmente.
`,

  memo: ({ para, de, asunto, fecha, cuerpo }) => `MEMORÁNDUM
==========

Para:    ${para}
De:      ${de}
Fecha:   ${fecha}
Asunto:  ${asunto}

${cuerpo}

Atentamente,
${de}
${EMPRESA}
`,

  lista: ({ titulo, elementos }) => `${titulo.toUpperCase()}
${'-'.repeat(titulo.length)}

${elementos.map((e) => `[ ] ${e}`).join('\n')}

Revisado por: ____________________   Fecha: ____/____/2026
`,

  presupuesto: ({ titulo, partidas }) => {
    const total = partidas.reduce((s, [, monto]) => s + monto, 0);
    const ancho = Math.max(...partidas.map(([n]) => n.length), 10);
    return `${titulo}
${'='.repeat(titulo.length)}

${partidas.map(([nombre, monto]) => `${nombre.padEnd(ancho)}  ${moneda(monto).padStart(16)}`).join('\n')}
${'-'.repeat(ancho + 18)}
${'TOTAL'.padEnd(ancho)}  ${moneda(total).padStart(16)}

Montos en quetzales. Sujeto a aprobación de gerencia.
`;
  },

  procedimiento: ({ titulo, codigo, pasos }) => `# ${titulo}

Código: \`${codigo}\`

## Pasos

${pasos.map((p, i) => `### Paso ${i + 1}\n\n${p}\n`).join('\n')}
## Registro

Cada ejecución del procedimiento debe quedar anotada en la bitácora del área.
`,

  notas: ({ titulo, lineas }) => `${titulo}

${lineas.join('\n')}
`,
};
