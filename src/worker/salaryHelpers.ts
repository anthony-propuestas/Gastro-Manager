export function calcSalaryRow(salary: number, advances: number, isPaid: boolean) {
  const net = salary - advances;
  const paid_amount = advances + (isPaid ? net : 0);
  const remaining = isPaid ? 0 : net;
  return { net, paid_amount, remaining };
}
