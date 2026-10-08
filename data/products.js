/* ==========================================================
   Product catalog.
   Taste scale: 1 (low) → 5 (high) for acidity, body, roast, bitterness.
   Prices are per 12 oz (340 g) bag, in USD.
   Exposed globally so the project works from file:// without modules.
   ========================================================== */
window.PRODUCTS = [
  {
    id: "eth-yirgacheffe-kochere",
    name: "Yirgacheffe Kochere",
    origin: "Ethiopia",
    region: "Gedeo Zone, Yirgacheffe",
    process: "Washed",
    variety: "Heirloom",
    altitude: "1,900–2,200 m",
    roastLabel: "Light",
    price: 19.5,
    badge: "Staff Favorite",
    notes: "Tea-like and floral with a bright citrus lift. A classic clean Ethiopian — beautiful as a pour-over.",
    taste: { acidity: 5, body: 2, roast: 1, bitterness: 1 },
    flavors: ["Jasmine", "Bergamot", "Peach", "Lemon Tea"]
  },
  {
    id: "eth-guji-natural",
    name: "Guji Hambela Natural",
    origin: "Ethiopia",
    region: "Guji Zone, Oromia",
    process: "Natural",
    variety: "Heirloom",
    altitude: "2,000–2,300 m",
    roastLabel: "Light",
    price: 21,
    badge: "New Harvest",
    notes: "Sun-dried on raised beds for a jammy, fruit-forward cup that tastes like a blueberry pastry.",
    taste: { acidity: 4, body: 3, roast: 2, bitterness: 1 },
    flavors: ["Blueberry", "Strawberry Jam", "Cacao", "Honey"]
  },
  {
    id: "col-huila-washed",
    name: "Huila La Esperanza",
    origin: "Colombia",
    region: "Huila, Pitalito",
    process: "Washed",
    variety: "Caturra, Castillo",
    altitude: "1,650–1,900 m",
    roastLabel: "Medium",
    price: 17.5,
    badge: "Best Seller",
    notes: "Balanced, sweet and endlessly drinkable. Our everyday coffee for filter or espresso.",
    taste: { acidity: 3, body: 3, roast: 3, bitterness: 2 },
    flavors: ["Red Apple", "Caramel", "Milk Chocolate"]
  },
  {
    id: "col-narino-honey",
    name: "Nariño Honey Lot",
    origin: "Colombia",
    region: "Nariño, La Unión",
    process: "Honey",
    variety: "Caturra",
    altitude: "1,900–2,150 m",
    roastLabel: "Medium-Light",
    price: 18.75,
    badge: "",
    notes: "Honey-processed for a silky body and layered sweetness, with a gentle orange acidity.",
    taste: { acidity: 3, body: 4, roast: 2, bitterness: 2 },
    flavors: ["Panela", "Orange Zest", "Almond", "Brown Sugar"]
  },
  {
    id: "bra-cerrado-natural",
    name: "Cerrado Mineiro Natural",
    origin: "Brazil",
    region: "Cerrado Mineiro, Minas Gerais",
    process: "Natural",
    variety: "Yellow Bourbon",
    altitude: "1,000–1,250 m",
    roastLabel: "Medium-Dark",
    price: 15.5,
    badge: "Espresso Pick",
    notes: "Nutty, chocolatey and heavy-bodied. A dependable espresso base that cuts through milk beautifully.",
    taste: { acidity: 2, body: 4, roast: 4, bitterness: 3 },
    flavors: ["Hazelnut", "Dark Chocolate", "Toasted Sugar"]
  },
  {
    id: "bra-sul-minas-pulped",
    name: "Sul de Minas Pulped Natural",
    origin: "Brazil",
    region: "Sul de Minas, Carmo de Minas",
    process: "Honey",
    variety: "Mundo Novo, Catuaí",
    altitude: "1,100–1,300 m",
    roastLabel: "Medium",
    price: 16.25,
    badge: "",
    notes: "Smooth and round with a sweet, nutty finish. Great in a French press or moka pot.",
    taste: { acidity: 2, body: 5, roast: 3, bitterness: 2 },
    flavors: ["Walnut", "Cacao Nibs", "Maple", "Baked Pear"]
  }
];
