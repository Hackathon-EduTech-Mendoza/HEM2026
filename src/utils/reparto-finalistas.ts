// src/utils/reparto-finalistas.ts
//
// Reparto del cupo de finalistas entre los grupos del jurado.
//
// Con el jurado dividido en grupos, cada grupo puntúa con su propia vara.
// Medido en dev con tres grupos calibrados distinto (duro / normal / generoso),
// el ranking global dejaba al grupo exigente con 1 finalista de 10: su mejor
// proyecto salía décimo con 64,6 y el peor del generoso salía cuarto con 89,5.
// El cálculo no está mal —todos promedian con avg() en la misma escala—, el
// problema es de equidad: un proyecto compite contra la severidad de su jurado
// y no solo contra los otros proyectos.
//
// Dentro de cada grupo, en cambio, la comparación es limpia. De ahí el reparto:
// se eligen los mejores DE CADA GRUPO, y cuántos le tocan a cada uno sale de
// esta función.
//
// Vive acá y no dentro del `<script>` del admin para poder testearla: decide
// quién llega a la ronda final, y eso no se verifica a ojo el día del evento.

/**
 * Reparte `total` lugares entre grupos por el **método del resto mayor**, en
 * proporción a cuántos proyectos evaluó cada uno.
 *
 * Cada grupo recibe primero su cuota entera; los lugares que sobran van, de a
 * uno, a los grupos con el resto más grande. Es el mismo método con el que se
 * reparten bancas, y es el que hace que el resultado no dependa del orden en
 * que vengan los grupos.
 *
 * ⚠️ Ningún grupo puede recibir más lugares que proyectos tiene. Si uno queda
 * corto, sus lugares sobrantes se redistribuyen entre los que todavía tienen
 * lugar. Sin ese tope, un grupo con 2 proyectos se llevaría 3 finalistas y se
 * marcarían checkboxes que no existen.
 *
 * @param tamanos Proyectos por grupo. La clave es el grupo (`"1"`, `"2"`, o
 *                `"todos"` para los que evaluó el jurado completo).
 * @param total   Cupo de finalistas a repartir.
 * @returns Lugares por grupo. Siempre trae **todas** las claves de `tamanos`,
 *          incluso las que reciben 0.
 */
export function repartirPorGrupo(
  tamanos: Map<string, number>,
  total: number,
): Map<string, number> {
  const asignado = new Map<string, number>();

  // Se normaliza a entero no negativo: un tamaño negativo o fraccionario no
  // significa nada acá y envenenaría la proporción.
  const limpios = new Map<string, number>();
  tamanos.forEach((n, clave) => {
    limpios.set(clave, Math.max(0, Math.floor(n)));
    asignado.set(clave, 0);
  });

  const totalProyectos = Array.from(limpios.values()).reduce((a, b) => a + b, 0);
  if (totalProyectos === 0 || total <= 0) return asignado;

  // No se pueden repartir más lugares que proyectos hay.
  let restantes = Math.min(Math.floor(total), totalProyectos);

  const entradas = Array.from(limpios.entries()).map(([clave, n]) => {
    const exacta = (n * restantes) / totalProyectos;
    asignado.set(clave, Math.min(n, Math.floor(exacta)));
    return { clave, n, resto: exacta - Math.floor(exacta) };
  });

  restantes -= Array.from(asignado.values()).reduce((a, b) => a + b, 0);

  // Resto mayor primero. Los desempates son deterministas —más proyectos, y
  // después el nombre del grupo— para que dos clicks seguidos den lo mismo.
  entradas.sort((a, b) => b.resto - a.resto || b.n - a.n || a.clave.localeCompare(b.clave));

  // Vueltas hasta agotar los lugares. Se dan de a uno y salteando los grupos
  // llenos, así lo que sobra de un grupo chico cae en los que tienen lugar.
  while (restantes > 0) {
    let repartioAlguno = false;
    for (const e of entradas) {
      if (restantes === 0) break;
      const actual = asignado.get(e.clave) ?? 0;
      if (actual < e.n) {
        asignado.set(e.clave, actual + 1);
        restantes--;
        repartioAlguno = true;
      }
    }
    if (!repartioAlguno) break; // todos llenos: no hay a quién darle
  }

  return asignado;
}

/**
 * Resumen legible del reparto, para el toast del admin: `"G1: 4 · G2: 3 · G3: 3"`.
 * Ordena por clave para que dos repartos iguales se lean iguales.
 */
export function describirReparto(cupos: Map<string, number>): string {
  return Array.from(cupos.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([clave, n]) => `${clave === 'todos' ? 'Todos' : `G${clave}`}: ${n}`)
    .join(' · ');
}
