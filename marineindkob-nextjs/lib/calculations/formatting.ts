/**
 * Dansk valutaformat i hele brugerfladen — jf. Fase 3-oplægget, afsnit 18.
 * Bruger Intl.NumberFormat("da-DK", …) og tilføjer " kr." efter tallet,
 * så det matcher den danske skrivemåde (fx "1.285,00 kr.").
 */
const formatter = new Intl.NumberFormat("da-DK", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function formatCurrency(amount: number): string {
  return `${formatter.format(amount)} kr.`;
}

/** Datoformat dd-MM-yyyy til CSV-eksport, jf. afsnit 23. */
export function formatDateDMY(isoDate: string): string {
  const d = new Date(isoDate + (isoDate.length <= 10 ? "T00:00:00" : ""));
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}
