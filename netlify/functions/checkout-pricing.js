function buildAuthoritativeTotals(order, fallbackSubtotal = 0, taxRate = 0.0875) {
  const subtotal = calculateOrderSubtotal(order) || Math.max(0, Number(fallbackSubtotal || 0));
  const cloverTotal = Math.max(0, Number(order?.total || 0));
  let tax = Math.max(0, cloverTotal - subtotal);
  let total = cloverTotal > subtotal ? cloverTotal : subtotal + tax;

  // Atomic Clover orders can occasionally return the merchandise subtotal as
  // order.total before tax has been applied. Retain Victor's configured tax fallback.
  if (subtotal > 0 && tax <= 0) {
    tax = Math.round(subtotal * taxRate);
    total = subtotal + tax;
  }

  return { subtotal, tax, total };
}

function calculateOrderSubtotal(order) {
  const lineItems = order?.lineItems?.elements || order?.lineItems || [];
  if (!Array.isArray(lineItems) || !lineItems.length) return 0;

  return lineItems.reduce((sum, lineItem) => {
    const basePrice = Math.max(0, Number(lineItem?.price || 0));
    const modifications = lineItem?.modifications?.elements || lineItem?.modifications || [];
    const modifierTotal = Array.isArray(modifications)
      ? modifications.reduce((total, modification) => {
          const price = modification?.amount ?? modification?.price ?? modification?.modifier?.price ?? 0;
          return total + Math.max(0, Number(price || 0));
        }, 0)
      : 0;

    return sum + basePrice + modifierTotal;
  }, 0);
}

module.exports = {
  buildAuthoritativeTotals,
  calculateOrderSubtotal
};
