(function exposeWeeklySocialDrafts(global) {
  "use strict";

  const WEBSITE = "https://theosfarm.com";
  const IMAGES = Object.freeze({
    bags: `${WEBSITE}/assets/theos-both-bags.jpg`,
    twenty: `${WEBSITE}/assets/theos-20lb-bag.jpg`,
    forty: `${WEBSITE}/assets/theos-40lb-bag.jpg`,
    farm: `${WEBSITE}/assets/ear-corn-hero.png`,
    packed: `${WEBSITE}/assets/theos-shipping-box-packed.jpg`,
    shipped: `${WEBSITE}/assets/theos-shipping-box-sealed.jpg`,
  });
  const THEMES = Object.freeze([
    Object.freeze([
      ["farm-to-feeder", "Fresh whole ear corn, packed at Theo's Farm and shipped direct to your wildlife feeder. Choose a 20 lb or 40 lb bag of cleaned cob corn, packed to order at the farm.", ["#TheosFarm", "#FarmToFeeder", "#EarCorn", "#WildlifeCorn", "#CobCorn"], IMAGES.bags],
      ["whole-cob-choice", "Give deer, squirrels, and backyard wildlife the whole-cob feeding experience. Theo's Farm offers cleaned whole ear corn in practical 20 lb and 40 lb bags.", ["#TheosFarm", "#WholeEarCorn", "#WildlifeFeeders", "#DeerCorn"], IMAGES.bags],
      ["direct-from-the-farm", "From our Illinois family farm to your feeder: whole ear corn selected, packed, and shipped in 20 lb and 40 lb bags.", ["#TheosFarm", "#FarmDirect", "#EarCorn", "#WildlifeCorn"], IMAGES.farm],
      ["feeder-ready-corn", "Stock the feeder with whole ear corn prepared for deer, squirrels, and backyard wildlife. Theo's Farm ships 20 lb and 40 lb bags direct from the farm.", ["#TheosFarm", "#WildlifeFeeders", "#CobCorn", "#FarmToFeeder"], IMAGES.bags],
    ]),
    Object.freeze([
      ["cleaned-and-selected", "Good wildlife corn starts with good ears. Theo's Farm removes husks and foreign material, then takes out small or partially filled ears before each order is packaged.", ["#TheosFarm", "#WholeEarCorn", "#EarCorn", "#WildlifeFeeding"], IMAGES.twenty],
      ["quality-in-every-bag", "Every bag starts with cleaned, selected ears. We remove husks, foreign material, and undersized ears before packing your wildlife corn.", ["#TheosFarm", "#EarCorn", "#FarmQuality", "#WildlifeCorn"], IMAGES.twenty],
      ["selected-whole-ears", "Theo's Farm whole ear corn is cleaned and selected before it reaches the bag, helping you put dependable cob corn in the feeder.", ["#TheosFarm", "#WholeEarCorn", "#CobCorn", "#WildlifeFeeders"], IMAGES.forty],
      ["clean-cob-corn", "Husks and foreign material do not belong in your feeder. Our whole ear corn is cleaned, checked, and packed to order.", ["#TheosFarm", "#EarCorn", "#PackedToOrder", "#WildlifeFeeding"], IMAGES.twenty],
    ]),
    Object.freeze([
      ["family-farm-story", "Theo's Farm is part of a sixth-generation family farm dating back to 1894, with 40 years of experience growing and packaging ear corn for wildlife food.", ["#TheosFarm", "#FamilyFarm", "#FarmToFeeder", "#EarCorn"], IMAGES.farm],
      ["six-generations", "Six generations of family farming stand behind every Theo's Farm order. Our farm history reaches back to 1894.", ["#TheosFarm", "#SixthGeneration", "#FamilyFarm", "#IllinoisFarm"], IMAGES.farm],
      ["forty-years-ear-corn", "For 40 years, our family has grown and packaged ear corn for wildlife food. Theo's Farm brings that experience directly to today's feeder.", ["#TheosFarm", "#FamilyFarm", "#EarCorn", "#WildlifeCorn"], IMAGES.farm],
      ["rooted-since-1894", "Rooted in family farming since 1894, Theo's Farm continues a long tradition of growing and preparing quality ear corn.", ["#TheosFarm", "#FarmHistory", "#FamilyFarm", "#WholeEarCorn"], IMAGES.farm],
    ]),
    Object.freeze([
      ["choose-your-bag", "Stocking a backyard feeder or a larger wildlife feeding area? Theo's Farm offers 20 lb and 40 lb bags of whole ear corn so you can choose the amount that fits your setup.", ["#TheosFarm", "#DeerCorn", "#SquirrelCorn", "#WholeEarCorn"], IMAGES.bags],
      ["twenty-or-forty", "Choose the bag that fits your feeder: a convenient 20 lb bag or a larger 40 lb bag of cleaned whole ear corn.", ["#TheosFarm", "#EarCorn", "#WildlifeFeeders", "#CobCorn"], IMAGES.bags],
      ["two-bag-sizes", "Backyard feeder or larger wildlife area, Theo's Farm has an option: 20 lb and 40 lb bags of whole ear corn shipped direct.", ["#TheosFarm", "#DeerCorn", "#WildlifeCorn", "#FarmDirect"], IMAGES.bags],
      ["fit-your-feeder", "Match your corn order to your feeding setup with Theo's Farm 20 lb and 40 lb whole ear corn bags.", ["#TheosFarm", "#WholeEarCorn", "#SquirrelCorn", "#WildlifeFeeders"], IMAGES.bags],
    ]),
    Object.freeze([
      ["packed-to-order", "Every Theo's Farm bag is packaged to order. We do not ship old bagged inventory—your whole ear corn is prepared when your order is ready to go.", ["#TheosFarm", "#PackedToOrder", "#EarCorn", "#FarmToFeeder"], IMAGES.forty],
      ["prepared-for-your-order", "Your whole ear corn is prepared when you order it. Theo's Farm packages each 20 lb and 40 lb bag to order.", ["#TheosFarm", "#PackedToOrder", "#WholeEarCorn", "#FarmDirect"], IMAGES.forty],
      ["not-old-inventory", "Packed to order means your Theo's Farm ear corn is not sitting as old bagged inventory waiting to ship.", ["#TheosFarm", "#FreshlyPacked", "#EarCorn", "#WildlifeCorn"], IMAGES.twenty],
      ["order-then-pack", "You order, then we prepare the bag. That is the packed-to-order approach behind Theo's Farm whole ear corn.", ["#TheosFarm", "#PackedToOrder", "#CobCorn", "#FamilyFarm"], IMAGES.forty],
    ]),
    Object.freeze([
      ["protected-for-shipping", "Whole ear corn needs solid shipping protection. Each Theo's Farm order is packed in a durable woven bag, wrapped with a paper overlay, and boxed for the trip from our farm to your feeder.", ["#TheosFarm", "#EarCorn", "#FarmToFeeder", "#ShippedDirect"], IMAGES.packed],
      ["bagged-wrapped-boxed", "Bagged, wrapped, and boxed: Theo's Farm protects whole ear corn through every stage of its trip to your feeder.", ["#TheosFarm", "#WholeEarCorn", "#Shipping", "#FarmDirect"], IMAGES.packed],
      ["shipping-protection", "We package whole ear corn for the realities of shipping, using a woven bag, paper overlay, and sturdy outer box.", ["#TheosFarm", "#EarCorn", "#PackedToOrder", "#ShippedDirect"], IMAGES.shipped],
      ["ready-for-the-trip", "From woven bag to protective paper and outer box, a Theo's Farm order is prepared for the trip from our farm to your door.", ["#TheosFarm", "#FarmToFeeder", "#WildlifeCorn", "#Shipping"], IMAGES.shipped],
    ]),
    Object.freeze([
      ["keep-the-feeder-stocked", "Keep your wildlife feeder ready for the week ahead with whole ear corn from Theo's Farm. Our 20 lb and 40 lb bags ship direct from the farm for deer, squirrels, and backyard wildlife.", ["#TheosFarm", "#WildlifeFeeders", "#DeerCorn", "#SquirrelCorn"], IMAGES.shipped],
      ["week-ahead-feeding", "Plan for the week ahead with farm-direct whole ear corn for deer, squirrels, and the wildlife visiting your feeder.", ["#TheosFarm", "#WholeEarCorn", "#WildlifeFeeding", "#FarmDirect"], IMAGES.bags],
      ["stock-your-feeder", "A stocked feeder starts with the right supply. Choose a 20 lb or 40 lb bag of Theo's Farm whole ear corn.", ["#TheosFarm", "#WildlifeFeeders", "#EarCorn", "#CobCorn"], IMAGES.bags],
      ["backyard-wildlife-ready", "Get the backyard wildlife feeder ready with cleaned whole ear corn shipped directly from Theo's Farm.", ["#TheosFarm", "#BackyardWildlife", "#SquirrelCorn", "#DeerCorn"], IMAGES.shipped],
    ]),
  ]);

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function dateKey(date) {
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }

  function centralCalendarDate(now) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return new Date(Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)));
  }

  function nthSunday(year, month, occurrence) {
    const first = new Date(Date.UTC(year, month, 1));
    return 1 + ((7 - first.getUTCDay()) % 7) + ((occurrence - 1) * 7);
  }

  function centralScheduledIso(date) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    const start = new Date(Date.UTC(year, 2, nthSunday(year, 2, 2)));
    const end = new Date(Date.UTC(year, 10, nthSunday(year, 10, 1)));
    const daylight = date >= start && date < end;
    return new Date(Date.UTC(year, month, day, daylight ? 13 : 14, 30)).toISOString();
  }

  function upcomingMonday(now = new Date()) {
    const localDate = centralCalendarDate(now);
    const daysUntilMonday = (8 - localDate.getUTCDay()) % 7;
    localDate.setUTCDate(localDate.getUTCDate() + daysUntilMonday);
    return localDate;
  }

  function generateWeeklyBatch(now = new Date()) {
    const monday = upcomingMonday(now);
    const epoch = Date.UTC(2026, 0, 5);
    const rotation = Math.floor((monday.getTime() - epoch) / 604800000) % 4;
    const posts = THEMES.map((variants, index) => {
      const scheduledDate = new Date(monday);
      scheduledDate.setUTCDate(monday.getUTCDate() + index);
      const [slug, text, hashtags, imageUrl] = variants[(rotation + index) % variants.length];
      const day = dateKey(scheduledDate);
      return {
        postId: `${day}-${slug}`,
        scheduledAt: centralScheduledIso(scheduledDate),
        status: "draft",
        platforms: ["facebook", "instagram"],
        caption: `${text}\n\nShop at ${WEBSITE}`,
        hashtags: [...hashtags],
        imageUrl,
      };
    });
    return {
      weekOf: dateKey(monday),
      reviewStatus: "draft",
      generatedAt: new Date(now).toISOString(),
      posts,
    };
  }

  const api = Object.freeze({ centralScheduledIso, generateWeeklyBatch, upcomingMonday });
  global.TheosWeeklySocialDrafts = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window === "object" ? window : globalThis);
