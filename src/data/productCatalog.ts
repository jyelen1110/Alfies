// Alfie's Food Co. - Wholesale Product Catalog
// Extracted from August 2025 Brochure

export interface ProductData {
  name: string;
  supplier: string;
  category?: string;  // Leave blank if vague (e.g., "product", "variety")
  country_of_origin?: string;  // Only for nut pouch items
  size: string;
  carton_size: number;
  wholesale_price: number;
  rrp: number;
  barcode?: string;
}

export const SUPPLIERS = [
  { name: "Alfie's Food Co.", category: "Nut Butters & Nuts" },
  { name: "Annies", category: "Fruit Snacks" },
  { name: "Beyond", category: "Beverages" },
  { name: "Burleigh Chilli Co.", category: "Hot Sauces" },
  { name: "Butterfingers", category: "Biscuits" },
  { name: "Crispy Bite", category: "Crackers" },
  { name: "Crunch Preserves", category: "Condiments" },
  { name: "CubbyHouse Canteen", category: "Biscuits" },
  { name: "D.Jays Gourmet", category: "Jerky" },
  { name: "Dillicious", category: "Pickles" },
  { name: "Drizzle", category: "Dressings" },
  { name: "East Forged", category: "Beverages" },
  { name: "Elly's", category: "Snacks" },
  { name: "Flip Shelton's", category: "Muesli & Granola" },
  { name: "Fod Bods", category: "Protein Bars" },
  { name: "Fox Pops", category: "Snacks" },
  { name: "Island Pasta", category: "Pasta & Sauces" },
  { name: "K9 Katering", category: "Pet Treats" },
  { name: "Keating & Co", category: "Condiments" },
  { name: "KOJA", category: "Snack Bars" },
  { name: "Krunchilli", category: "Condiments" },
  { name: "Lani's", category: "Confectionery" },
  { name: "Maynards", category: "Confectionery" },
  { name: "Mehdi's", category: "Seasonings" },
  { name: "Melbourne Chilli Co.", category: "Condiments" },
  { name: "Mixed Bag", category: "Beverages" },
  { name: "Monk's", category: "Beverages" },
  { name: "Mootilda", category: "Personal Care" },
  { name: "Penny's", category: "Snacks" },
  { name: "Pistabella", category: "Spreads" },
  { name: "Sad Girl", category: "Spreads" },
  { name: "Schulte's", category: "Jerky" },
  { name: "Six Barrel Soda", category: "Beverages" },
  { name: "Snack Lovers", category: "Snacks" },
  { name: "Sodasmith", category: "Beverages" },
  { name: "Southern Seagreens", category: "Seasonings" },
  { name: "Suzie's", category: "Protein Bars" },
  { name: "Ted & Mems", category: "Muesli & Granola" },
  { name: "The Crafty Weka", category: "Snack Bars" },
  { name: "The Salt Box", category: "Seasonings" },
  { name: "Truckin' Good", category: "Jerky" },
  { name: "Tuck Shop Sauce Co.", category: "Sauces" },
  { name: "Uncle John's", category: "Confectionery" },
  { name: "Wintulichs", category: "Smallgoods" },
  { name: "Zero Bites", category: "Snacks" },
];

export const PRODUCTS: ProductData[] = [
  // ============================================
  // ALFIE'S FOOD CO. - NUT BUTTERS (SMALL)
  // ============================================
  { name: "Smooth Peanut Butter 300g", supplier: "Alfie's Food Co.", category: "Nut Butters", size: "300g", carton_size: 6, wholesale_price: 5.37, rrp: 7.90, barcode: "0806809032026" },
  { name: "Crunchy Peanut Butter 300g", supplier: "Alfie's Food Co.", category: "Nut Butters", size: "300g", carton_size: 6, wholesale_price: 5.37, rrp: 7.90, barcode: "0806809032033" },
  { name: "Smooth Dark Roasted Peanut Butter 300g", supplier: "Alfie's Food Co.", category: "Nut Butters", size: "300g", carton_size: 6, wholesale_price: 5.00, rrp: 7.50, barcode: "0806809032125" },
  { name: "Crunchy Dark Roasted Peanut Butter 300g", supplier: "Alfie's Food Co.", category: "Nut Butters", size: "300g", carton_size: 6, wholesale_price: 5.00, rrp: 7.50, barcode: "0806809032118" },
  { name: "Almond Butter 250g", supplier: "Alfie's Food Co.", category: "Nut Butters", size: "250g", carton_size: 6, wholesale_price: 6.30, rrp: 9.65, barcode: "0806809032040" },
  { name: "Organic Almond Butter 250g", supplier: "Alfie's Food Co.", category: "Nut Butters", size: "250g", carton_size: 6, wholesale_price: 11.00, rrp: 15.95, barcode: "0806809032057" },
  { name: "Cashew Butter 250g", supplier: "Alfie's Food Co.", category: "Nut Butters", size: "250g", carton_size: 6, wholesale_price: 7.95, rrp: 11.95, barcode: "0806809032064" },
  { name: "ABC (Almond, Brazil & Cashew) Butter 250g", supplier: "Alfie's Food Co.", category: "Nut Butters", size: "250g", carton_size: 6, wholesale_price: 7.45, rrp: 10.45, barcode: "0806809032101" },
  { name: "Almond & Pistachio Butter 250g", supplier: "Alfie's Food Co.", category: "Nut Butters", size: "250g", carton_size: 6, wholesale_price: 7.55, rrp: 10.95, barcode: "0806809032132" },

  // NUT BUTTERS (MEDIUM/LARGE)
  { name: "Smooth Peanut Butter 500g", supplier: "Alfie's Food Co.", category: "Nut Butters", size: "500g", carton_size: 6, wholesale_price: 7.66, rrp: 10.95, barcode: "0806809032217" },
  { name: "Crunchy Peanut Butter 500g", supplier: "Alfie's Food Co.", category: "Nut Butters", size: "500g", carton_size: 6, wholesale_price: 7.66, rrp: 10.95, barcode: "0806809032200" },
  { name: "Smooth Dark Roasted Peanut Butter 500g", supplier: "Alfie's Food Co.", category: "Nut Butters", size: "500g", carton_size: 6, wholesale_price: 7.66, rrp: 10.95, barcode: "0806809032224" },
  { name: "Crunchy Dark Roasted Peanut Butter 500g", supplier: "Alfie's Food Co.", category: "Nut Butters", size: "500g", carton_size: 6, wholesale_price: 7.66, rrp: 10.95, barcode: "0806809032194" },
  { name: "Almond Butter 500g", supplier: "Alfie's Food Co.", category: "Nut Butters", size: "500g", carton_size: 6, wholesale_price: 11.00, rrp: 14.95, barcode: "0806809032187" },
  { name: "Smooth Peanut Butter 800g", supplier: "Alfie's Food Co.", category: "Nut Butters", size: "800g", carton_size: 6, wholesale_price: 11.32, rrp: 14.95, barcode: "0806809032088" },
  { name: "Crunchy Peanut Butter 800g", supplier: "Alfie's Food Co.", category: "Nut Butters", size: "800g", carton_size: 6, wholesale_price: 11.32, rrp: 14.95, barcode: "0806809032071" },
  { name: "Smooth Dark Roasted Peanut Butter 800g", supplier: "Alfie's Food Co.", category: "Nut Butters", size: "800g", carton_size: 6, wholesale_price: 11.32, rrp: 14.95, barcode: "0806809032231" },
  { name: "Crunchy Dark Roasted Peanut Butter 800g", supplier: "Alfie's Food Co.", category: "Nut Butters", size: "800g", carton_size: 6, wholesale_price: 11.32, rrp: 14.95, barcode: "0806809032170" },
  { name: "Almond Butter 800g", supplier: "Alfie's Food Co.", category: "Nut Butters", size: "800g", carton_size: 6, wholesale_price: 14.95, rrp: 20.95, barcode: "0806809032095" },

  // PACKAGED NUTS
  { name: "Almond - Raw 250g", supplier: "Alfie's Food Co.", category: "Packaged Nuts", size: "250g", carton_size: 6, wholesale_price: 5.67, rrp: 7.95, barcode: "0787099979744" },
  { name: "Almond - Roasted 250g", supplier: "Alfie's Food Co.", category: "Packaged Nuts", size: "250g", carton_size: 6, wholesale_price: 5.13, rrp: 6.95, barcode: "0787099979737" },
  { name: "Almond - Organic/Roasted 250g", supplier: "Alfie's Food Co.", category: "Packaged Nuts", size: "250g", carton_size: 6, wholesale_price: 10.87, rrp: 13.95, barcode: "0787099979959" },
  { name: "Almond - Smoked 250g", supplier: "Alfie's Food Co.", category: "Packaged Nuts", size: "250g", carton_size: 6, wholesale_price: 6.58, rrp: 8.50, barcode: "0787099979751" },
  { name: "Almond - Tamari 250g", supplier: "Alfie's Food Co.", category: "Packaged Nuts", size: "250g", carton_size: 6, wholesale_price: 6.58, rrp: 8.50, barcode: "0787099979768" },
  { name: "Brazil - Raw 250g", supplier: "Alfie's Food Co.", category: "Packaged Nuts", size: "250g", carton_size: 6, wholesale_price: 8.72, rrp: 10.95, barcode: "0787099979775" },
  { name: "Cashew - Raw 250g", supplier: "Alfie's Food Co.", category: "Packaged Nuts", size: "250g", carton_size: 6, wholesale_price: 6.21, rrp: 8.20, barcode: "0787099979782" },
  { name: "Cashew - Roasted 250g", supplier: "Alfie's Food Co.", category: "Packaged Nuts", size: "250g", carton_size: 6, wholesale_price: 7.99, rrp: 9.95, barcode: "0787099979799" },
  { name: "Cashew - Cinnamon Roasted 250g", supplier: "Alfie's Food Co.", category: "Packaged Nuts", size: "250g", carton_size: 6, wholesale_price: 7.29, rrp: 9.50, barcode: "0787099979966" },
  { name: "Cashew - Honey Roasted 250g", supplier: "Alfie's Food Co.", category: "Packaged Nuts", size: "250g", carton_size: 6, wholesale_price: 7.12, rrp: 9.50, barcode: "0787099979973" },
  { name: "Cashew - Salted 250g", supplier: "Alfie's Food Co.", category: "Packaged Nuts", size: "250g", carton_size: 6, wholesale_price: 7.57, rrp: 9.75, barcode: "0787099980009" },
  { name: "Cashew - Thai Sweet Chilli 250g", supplier: "Alfie's Food Co.", category: "Packaged Nuts", size: "250g", carton_size: 6, wholesale_price: 7.29, rrp: 9.50, barcode: "0787099979980" },
  { name: "Hazelnut - Roasted 250g", supplier: "Alfie's Food Co.", category: "Packaged Nuts", size: "250g", carton_size: 6, wholesale_price: 8.35, rrp: 9.55, barcode: "0787099979881" },
  { name: "Macadamia - Raw 250g", supplier: "Alfie's Food Co.", category: "Packaged Nuts", size: "250g", carton_size: 6, wholesale_price: 11.56, rrp: 14.78, barcode: "0787099979812" },
  { name: "Macadamia - Roasted 250g", supplier: "Alfie's Food Co.", category: "Packaged Nuts", size: "250g", carton_size: 6, wholesale_price: 12.29, rrp: 17.65, barcode: "0787099979805" },
  { name: "Macadamia - Salted 250g", supplier: "Alfie's Food Co.", category: "Packaged Nuts", size: "250g", carton_size: 6, wholesale_price: 11.76, rrp: 17.95, barcode: "0787099980078" },
  { name: "Peanut - Roasted 250g", supplier: "Alfie's Food Co.", category: "Packaged Nuts", size: "250g", carton_size: 6, wholesale_price: 4.26, rrp: 5.95, barcode: "0787099979829" },
  { name: "Peanut - Salted 250g", supplier: "Alfie's Food Co.", category: "Packaged Nuts", size: "250g", carton_size: 6, wholesale_price: 4.06, rrp: 5.95, barcode: "0787099979997" },
  { name: "Pecan - Raw 250g", supplier: "Alfie's Food Co.", category: "Packaged Nuts", size: "250g", carton_size: 6, wholesale_price: 10.49, rrp: 13.55, barcode: "0787099979836" },
  { name: "Pine Nut - Raw 250g", supplier: "Alfie's Food Co.", category: "Packaged Nuts", size: "250g", carton_size: 6, wholesale_price: 14.78, rrp: 19.95, barcode: "0787099979843" },
  { name: "Pistachio - Raw 250g", supplier: "Alfie's Food Co.", category: "Packaged Nuts", size: "250g", carton_size: 6, wholesale_price: 14.78, rrp: 19.95, barcode: "0787099979850" },
  { name: "Pistachio - Salted 250g", supplier: "Alfie's Food Co.", category: "Packaged Nuts", size: "250g", carton_size: 6, wholesale_price: 8.35, rrp: 10.95, barcode: "0787099979867" },
  { name: "Pretzel - Knots 250g", supplier: "Alfie's Food Co.", category: "Snacks", size: "250g", carton_size: 6, wholesale_price: 4.06, rrp: 5.95, barcode: "0787099980016" },
  { name: "Pretzel - Peanut Butter 250g", supplier: "Alfie's Food Co.", category: "Snacks", size: "250g", carton_size: 6, wholesale_price: 6.56, rrp: 7.95, barcode: "0787099980023" },
  { name: "Walnut - Raw 250g", supplier: "Alfie's Food Co.", category: "Packaged Nuts", size: "250g", carton_size: 6, wholesale_price: 7.12, rrp: 9.95, barcode: "0787099979874" },

  // ============================================
  // ANNIES - FRUIT BARS & SNACKS
  // ============================================
  { name: "Berry Fruit Flats (8 Pack)", supplier: "Annies", category: "Fruit Snacks", size: "10g", carton_size: 14, wholesale_price: 6.21, rrp: 9.95, barcode: "9415743000346" },
  { name: "Summer Fruit Flats (8 Pack)", supplier: "Annies", category: "Fruit Snacks", size: "10g", carton_size: 14, wholesale_price: 6.21, rrp: 9.95, barcode: "9415743000353" },
  { name: "Fruit Jerky 100g", supplier: "Annies", category: "Fruit Snacks", size: "100g", carton_size: 14, wholesale_price: 6.21, rrp: 9.95, barcode: "9415743000674" },
  { name: "Fruit Strips 90g", supplier: "Annies", category: "Fruit Snacks", size: "90g", carton_size: 14, wholesale_price: 6.21, rrp: 9.95, barcode: "9415743000360" },
  { name: "Apple & Apricot Bar 20g", supplier: "Annies", category: "Fruit Bars", size: "20g", carton_size: 36, wholesale_price: 1.25, rrp: 1.90, barcode: "9415743000384" },
  { name: "Apple & Boysenberry Bar 20g", supplier: "Annies", category: "Fruit Bars", size: "20g", carton_size: 36, wholesale_price: 1.25, rrp: 1.90, barcode: "94186000" },
  { name: "Apple & Mango Passion Bar 20g", supplier: "Annies", category: "Fruit Bars", size: "20g", carton_size: 36, wholesale_price: 1.25, rrp: 1.90, barcode: "9415743000766" },
  { name: "Apple & Raspberry Bar 20g", supplier: "Annies", category: "Fruit Bars", size: "20g", carton_size: 36, wholesale_price: 1.25, rrp: 1.90, barcode: "9415743000421" },
  { name: "Apple & Strawberry Bar 20g", supplier: "Annies", category: "Fruit Bars", size: "20g", carton_size: 36, wholesale_price: 1.25, rrp: 1.90, barcode: "9415743000377" },
  { name: "Wiggles Cherrieberrie 12g", supplier: "Annies", category: "Fruit Snacks", size: "12g", carton_size: 60, wholesale_price: 1.13, rrp: 1.59, barcode: "9415743001367" },
  { name: "Collagen & Apple Bar 30g", supplier: "Annies", category: "Fruit Bars", size: "30g", carton_size: 20, wholesale_price: 2.90, rrp: 4.10, barcode: "9415743000988" },

  // ============================================
  // BEYOND - COCONUT WATER
  // ============================================
  { name: "Coconut Water Can 310ml", supplier: "Beyond", category: "Beverages", size: "310ml", carton_size: 24, wholesale_price: 2.03, rrp: 3.15, barcode: "9326154000088" },
  { name: "Coconut Water Bottle 1L", supplier: "Beyond", category: "Beverages", size: "1L", carton_size: 12, wholesale_price: 3.75, rrp: 5.40, barcode: "9326154000279" },

  // ============================================
  // BURLEIGH CHILLI CO - HOT SAUCES
  // ============================================
  { name: "Ankle Biter | Tomato & Red Chilli 200ml", supplier: "Burleigh Chilli Co.", category: "Hot Sauces", size: "200ml", carton_size: 12, wholesale_price: 12.00, rrp: 17.95, barcode: "0659359517501" },
  { name: "Cyclone Swell | Carrot & Habanero 200ml", supplier: "Burleigh Chilli Co.", category: "Hot Sauces", size: "200ml", carton_size: 12, wholesale_price: 12.00, rrp: 17.95, barcode: "0659359517525" },
  { name: "Point Break | Kiwi & Jalapeno 200ml", supplier: "Burleigh Chilli Co.", category: "Hot Sauces", size: "200ml", carton_size: 12, wholesale_price: 12.00, rrp: 17.95, barcode: "0659359517518" },
  { name: "Purple Haze | Beetroot & Plum 200ml", supplier: "Burleigh Chilli Co.", category: "Hot Sauces", size: "200ml", carton_size: 12, wholesale_price: 12.00, rrp: 17.95, barcode: "0659359535413" },
  { name: "Reef Break | Smoky Pineapple Habanero 200ml", supplier: "Burleigh Chilli Co.", category: "Hot Sauces", size: "200ml", carton_size: 12, wholesale_price: 12.00, rrp: 17.95 },
  { name: "Twin Fin | Mango, Orange & Cayenne 200ml", supplier: "Burleigh Chilli Co.", category: "Hot Sauces", size: "200ml", carton_size: 12, wholesale_price: 12.00, rrp: 17.95, barcode: "0659359535420" },

  // ============================================
  // BUTTERFINGERS - BISCUITS
  // ============================================
  { name: "Choc Chip Shortbread 175g", supplier: "Butterfingers", category: "Biscuits", size: "175g", carton_size: 10, wholesale_price: 4.23, rrp: 8.95, barcode: "9311005000072" },
  { name: "Ginger Shortbread 175g", supplier: "Butterfingers", category: "Biscuits", size: "175g", carton_size: 10, wholesale_price: 4.62, rrp: 8.95, barcode: "9311005999925" },
  { name: "Lemon Myrtle Shortbread 175g", supplier: "Butterfingers", category: "Biscuits", size: "175g", carton_size: 10, wholesale_price: 4.36, rrp: 8.95, barcode: "9311005100024" },
  { name: "Macadamia Shortbread 175g", supplier: "Butterfingers", category: "Biscuits", size: "175g", carton_size: 10, wholesale_price: 4.71, rrp: 8.95, barcode: "9311005001956" },
  { name: "Macadamia Gluten Free Shortbread 175g", supplier: "Butterfingers", category: "Biscuits", size: "175g", carton_size: 10, wholesale_price: 6.02, rrp: 9.95, barcode: "9311005100062" },
  { name: "Macadamia & Choc Chip Shortbread 175g", supplier: "Butterfingers", category: "Biscuits", size: "175g", carton_size: 10, wholesale_price: 4.80, rrp: 8.95, barcode: "9311005100147" },
  { name: "Pure Butter Shortbread 175g", supplier: "Butterfingers", category: "Biscuits", size: "175g", carton_size: 10, wholesale_price: 4.04, rrp: 8.95, barcode: "9311005000034" },
  { name: "Pure Butter Gluten Free Shortbread 175g", supplier: "Butterfingers", category: "Biscuits", size: "175g", carton_size: 10, wholesale_price: 5.55, rrp: 9.95, barcode: "9311005100055" },

  // ============================================
  // CRISPY BITE - CRACKERS
  // ============================================
  { name: "Crispbread Original 60g", supplier: "Crispy Bite", category: "Crackers", size: "60g", carton_size: 12, wholesale_price: 3.25, rrp: 4.99, barcode: "0793573534538" },
  { name: "Crispbread Onion 60g", supplier: "Crispy Bite", category: "Crackers", size: "60g", carton_size: 12, wholesale_price: 3.25, rrp: 4.99, barcode: "0754590293211" },
  { name: "Crispbread Cinnamon 60g", supplier: "Crispy Bite", category: "Crackers", size: "60g", carton_size: 12, wholesale_price: 3.25, rrp: 4.99, barcode: "0754590293228" },
  { name: "Crispbread Whole Wheat 60g", supplier: "Crispy Bite", category: "Crackers", size: "60g", carton_size: 12, wholesale_price: 3.25, rrp: 4.99, barcode: "0754590293204" },
  { name: "Crispbread Gluten Free 60g", supplier: "Crispy Bite", category: "Crackers", size: "60g", carton_size: 12, wholesale_price: 3.56, rrp: 5.19, barcode: "0781005943805" },

  // ============================================
  // CRUNCH PRESERVES - CONDIMENTS
  // ============================================
  { name: "Beetroot & Plum Chutney 200g", supplier: "Crunch Preserves", category: "Condiments", size: "200g", carton_size: 6, wholesale_price: 6.81, rrp: 10.45, barcode: "0799439060043" },
  { name: "Chilli Achar 200g", supplier: "Crunch Preserves", category: "Condiments", size: "200g", carton_size: 6, wholesale_price: 6.81, rrp: 10.45, barcode: "0799439060104" },
  { name: "Chilli Tomato Relish 200g", supplier: "Crunch Preserves", category: "Condiments", size: "200g", carton_size: 6, wholesale_price: 6.81, rrp: 10.45, barcode: "0799439060159" },
  { name: "Jalapeno Relish 200g", supplier: "Crunch Preserves", category: "Condiments", size: "200g", carton_size: 6, wholesale_price: 6.81, rrp: 10.45, barcode: "0799439060173" },
  { name: "Piccalilli Relish 200g", supplier: "Crunch Preserves", category: "Condiments", size: "200g", carton_size: 6, wholesale_price: 6.81, rrp: 10.45, barcode: "0799439060128" },
  { name: "Spicy Tomato Chutney 200g", supplier: "Crunch Preserves", category: "Condiments", size: "200g", carton_size: 6, wholesale_price: 6.81, rrp: 10.45, barcode: "0799439060067" },
  { name: "Tomato Relish 200g", supplier: "Crunch Preserves", category: "Condiments", size: "200g", carton_size: 6, wholesale_price: 6.81, rrp: 10.45, barcode: "0799439060135" },
  { name: "Caramelised Onion Jam 200g", supplier: "Crunch Preserves", category: "Condiments", size: "200g", carton_size: 6, wholesale_price: 6.81, rrp: 10.45, barcode: "0799439060289" },
  { name: "Chilli Jam 200g", supplier: "Crunch Preserves", category: "Condiments", size: "200g", carton_size: 6, wholesale_price: 6.81, rrp: 10.45, barcode: "0799439060098" },
  { name: "Fig & Szechuan Pepper Jam 200g", supplier: "Crunch Preserves", category: "Condiments", size: "200g", carton_size: 6, wholesale_price: 6.81, rrp: 10.45, barcode: "0799439060111" },
  { name: "Chilli Mango Sauce 250ml", supplier: "Crunch Preserves", category: "Sauces", size: "250ml", carton_size: 6, wholesale_price: 7.08, rrp: 10.85, barcode: "0799439060227" },
  { name: "Hot Chilli Sauce 250ml", supplier: "Crunch Preserves", category: "Sauces", size: "250ml", carton_size: 6, wholesale_price: 7.08, rrp: 10.85, barcode: "9369998260973" },
  { name: "Sweet Chilli Sauce 250ml", supplier: "Crunch Preserves", category: "Sauces", size: "250ml", carton_size: 6, wholesale_price: 7.08, rrp: 10.85, barcode: "0799439060210" },
  { name: "Tomato Sauce 250ml", supplier: "Crunch Preserves", category: "Sauces", size: "250ml", carton_size: 6, wholesale_price: 7.08, rrp: 10.85, barcode: "0799439060005" },
  { name: "Pasta Sauce - Tomato, Chilli & Rosemary 520g", supplier: "Crunch Preserves", category: "Pasta Sauces", size: "520g", carton_size: 6, wholesale_price: 7.80, rrp: 11.95, barcode: "0793618194765" },
  { name: "Pasta Sauce - Tomato, Roasted Garlic & Red Wine 520g", supplier: "Crunch Preserves", category: "Pasta Sauces", size: "520g", carton_size: 6, wholesale_price: 7.80, rrp: 11.95, barcode: "0793618194772" },
  { name: "Pasta Sauce - Tomato & Basil 520g", supplier: "Crunch Preserves", category: "Pasta Sauces", size: "520g", carton_size: 6, wholesale_price: 7.80, rrp: 11.95, barcode: "0799439060265" },
  { name: "Pasta Sauce - Tomato & Kalamata Olive 520g", supplier: "Crunch Preserves", category: "Pasta Sauces", size: "520g", carton_size: 6, wholesale_price: 7.80, rrp: 11.95, barcode: "0359777000012" },
  { name: "Pasta Sauce - Marinara 520g", supplier: "Crunch Preserves", category: "Pasta Sauces", size: "520g", carton_size: 6, wholesale_price: 7.80, rrp: 11.95, barcode: "9359777000029" },

  // ============================================
  // CUBBYHOUSE CANTEEN - GINGERBREAD
  // ============================================
  { name: "Gingerbread Cookie Original 60g", supplier: "CubbyHouse Canteen", category: "Biscuits", size: "60g", carton_size: 12, wholesale_price: 3.10, rrp: 4.85, barcode: "9369998271092" },
  { name: "Gingerbread Cookie Double Chocolate 60g", supplier: "CubbyHouse Canteen", category: "Biscuits", size: "60g", carton_size: 12, wholesale_price: 3.10, rrp: 4.85, barcode: "9369900028875" },
  { name: "Gingerbread Cookie Funfetti 60g", supplier: "CubbyHouse Canteen", category: "Biscuits", size: "60g", carton_size: 12, wholesale_price: 3.10, rrp: 4.85, barcode: "9369999929886" },

  // ============================================
  // D.JAYS GOURMET - BILTONG/JERKY
  // ============================================
  { name: "Biltong Sticks - Traditional 30g", supplier: "D.Jays Gourmet", category: "Jerky", size: "30g", carton_size: 6, wholesale_price: 3.85, rrp: 5.49, barcode: "9325749000007" },
  { name: "Sliced Biltong - Traditional 120g", supplier: "D.Jays Gourmet", category: "Jerky", size: "120g", carton_size: 6, wholesale_price: 9.00, rrp: 12.79, barcode: "9325749000038" },
  { name: "Snap Sticks - Traditional 50g", supplier: "D.Jays Gourmet", category: "Jerky", size: "50g", carton_size: 6, wholesale_price: 5.75, rrp: 7.95, barcode: "9325749000366" },
  { name: "Dry Sausage - Traditional 100g", supplier: "D.Jays Gourmet", category: "Jerky", size: "100g", carton_size: 6, wholesale_price: 7.25, rrp: 9.99, barcode: "9325749000359" },
  { name: "Beef Jerky - Traditional 200g", supplier: "D.Jays Gourmet", category: "Jerky", size: "200g", carton_size: 6, wholesale_price: 19.00, rrp: 25.99, barcode: "9325749000526" },
  { name: "Biltong Sticks - Chilli 30g", supplier: "D.Jays Gourmet", category: "Jerky", size: "30g", carton_size: 6, wholesale_price: 3.85, rrp: 5.49, barcode: "9325749000021" },
  { name: "Sliced Biltong - Chilli 120g", supplier: "D.Jays Gourmet", category: "Jerky", size: "120g", carton_size: 6, wholesale_price: 9.00, rrp: 12.79, barcode: "9325749000786" },
  { name: "Snap Sticks - Chilli 50g", supplier: "D.Jays Gourmet", category: "Jerky", size: "50g", carton_size: 6, wholesale_price: 5.75, rrp: 7.99, barcode: "9325749000472" },
  { name: "Dry Sausage - Chilli 100g", supplier: "D.Jays Gourmet", category: "Jerky", size: "100g", carton_size: 6, wholesale_price: 7.25, rrp: 9.99, barcode: "9325749000977" },
  { name: "Beef Jerky - Chilli 200g", supplier: "D.Jays Gourmet", category: "Jerky", size: "200g", carton_size: 6, wholesale_price: 19.00, rrp: 25.99, barcode: "9325749000311" },

  // ============================================
  // DILLICIOUS - PICKLES
  // ============================================
  { name: "Garlic Pickle Halves 675g", supplier: "Dillicious", category: "Pickles", size: "675g", carton_size: 6, wholesale_price: 9.30, rrp: 14.95, barcode: "9355629000018" },
  { name: "Sweet Pickle Halves 675g", supplier: "Dillicious", category: "Pickles", size: "675g", carton_size: 6, wholesale_price: 9.30, rrp: 14.95, barcode: "9355629000056" },
  { name: "Spicy Pickle Halves 675g", supplier: "Dillicious", category: "Pickles", size: "675g", carton_size: 6, wholesale_price: 9.30, rrp: 14.95, barcode: "9355629000032" },
  { name: "Garlic Pickle Chips 675g", supplier: "Dillicious", category: "Pickles", size: "675g", carton_size: 6, wholesale_price: 9.30, rrp: 14.95, barcode: "9355629000025" },
  { name: "Sweet Pickle Chips 675g", supplier: "Dillicious", category: "Pickles", size: "675g", carton_size: 6, wholesale_price: 9.30, rrp: 14.95, barcode: "9355629000063" },
  { name: "Spicy Pickle Chips 675g", supplier: "Dillicious", category: "Pickles", size: "675g", carton_size: 6, wholesale_price: 9.30, rrp: 14.95, barcode: "9355629000049" },

  // ============================================
  // DRIZZLE - SALAD DRESSING
  // ============================================
  { name: "Drizzle Original Dressing 250ml", supplier: "Drizzle", category: "Dressings", size: "250ml", carton_size: 6, wholesale_price: 10.25, rrp: 13.95, barcode: "0796548960486" },
  { name: "Drizzle Original Dressing Large 500ml", supplier: "Drizzle", category: "Dressings", size: "500ml", carton_size: 6, wholesale_price: 15.00, rrp: 20.95, barcode: "0796548960455" },
  { name: "Sweet & Spicy Wasabi Dressing 250ml", supplier: "Drizzle", category: "Dressings", size: "250ml", carton_size: 6, wholesale_price: 10.25, rrp: 13.95, barcode: "0726436094405" },
  { name: "Sweet & Spicy Wasabi Dressing Large 500ml", supplier: "Drizzle", category: "Dressings", size: "500ml", carton_size: 6, wholesale_price: 15.00, rrp: 20.95, barcode: "0796548960479" },
  { name: "Sugar Lite Dressing 250ml", supplier: "Drizzle", category: "Dressings", size: "250ml", carton_size: 6, wholesale_price: 11.25, rrp: 14.95, barcode: "0796548960493" },
  { name: "Sugar Lite Dressing Large 500ml", supplier: "Drizzle", category: "Dressings", size: "500ml", carton_size: 6, wholesale_price: 17.25, rrp: 22.95, barcode: "0796548960462" },

  // ============================================
  // EAST FORGED - COLD BREW TEAS
  // ============================================
  { name: "Black Tea w Yuzu 250ml", supplier: "East Forged", category: "Beverages", size: "250ml", carton_size: 15, wholesale_price: 2.85, rrp: 4.50, barcode: "9369998059218" },
  { name: "White Tea w Calamansi 250ml", supplier: "East Forged", category: "Beverages", size: "250ml", carton_size: 15, wholesale_price: 2.85, rrp: 4.50, barcode: "9369998138333" },
  { name: "Green Tea w Pitaya 250ml", supplier: "East Forged", category: "Beverages", size: "250ml", carton_size: 15, wholesale_price: 2.85, rrp: 4.50, barcode: "9369998226948" },

  // ============================================
  // ELLY'S - POPCORN
  // ============================================
  { name: "Salted Caramel Bang Popcorn 200g", supplier: "Elly's", category: "Snacks", size: "200g", carton_size: 6, wholesale_price: 7.53, rrp: 10.20, barcode: "0701748725476" },
  { name: "Salted Caramel Pop Popcorn 140g", supplier: "Elly's", category: "Snacks", size: "140g", carton_size: 6, wholesale_price: 6.55, rrp: 9.25, barcode: "0701748725407" },
  { name: "Smokey Maple Pop Popcorn 160g", supplier: "Elly's", category: "Snacks", size: "160g", carton_size: 6, wholesale_price: 6.55, rrp: 9.25, barcode: "7318825450980" },

  // ============================================
  // FLIP SHELTON'S - MUESLI
  // ============================================
  { name: "Natural Muesli Fruit, Nuts & Seed 500g", supplier: "Flip Shelton's", category: "Muesli & Granola", size: "500g", carton_size: 12, wholesale_price: 10.00, rrp: 15.50, barcode: "9340255000181" },
  { name: "Natural Muesli Fruit, Nuts & Seed 1kg", supplier: "Flip Shelton's", category: "Muesli & Granola", size: "1kg", carton_size: 6, wholesale_price: 16.25, rrp: 25.00, barcode: "9340255000198" },
  { name: "Natural Muesli Fruit & Coconut 500g", supplier: "Flip Shelton's", category: "Muesli & Granola", size: "500g", carton_size: 12, wholesale_price: 8.75, rrp: 13.50, barcode: "9340255000211" },
  { name: "Natural Muesli Fruit & Coconut 1kg", supplier: "Flip Shelton's", category: "Muesli & Granola", size: "1kg", carton_size: 6, wholesale_price: 15.00, rrp: 23.25, barcode: "9340255000228" },
  { name: "Natural Muesli Nuts & Seeds 500g", supplier: "Flip Shelton's", category: "Muesli & Granola", size: "500g", carton_size: 12, wholesale_price: 11.25, rrp: 17.40, barcode: "9340255000242" },
  { name: "Natural Muesli Nuts & Seeds 1kg", supplier: "Flip Shelton's", category: "Muesli & Granola", size: "1kg", carton_size: 6, wholesale_price: 17.50, rrp: 27.10, barcode: "9340255000259" },
  { name: "Five Grain Porridge 1kg", supplier: "Flip Shelton's", category: "Muesli & Granola", size: "1kg", carton_size: 6, wholesale_price: 11.25, rrp: 17.45, barcode: "9340255000280" },
  { name: "Honey-Roasted Muesli Crumble 800g", supplier: "Flip Shelton's", category: "Muesli & Granola", size: "800g", carton_size: 6, wholesale_price: 25.00, rrp: 38.75, barcode: "9340255000389" },

  // ============================================
  // FOD BODS - PROTEIN BARS
  // ============================================
  { name: "Banana Peanut Protein Bar 50g", supplier: "Fod Bods", category: "Protein Bars", size: "50g", carton_size: 10, wholesale_price: 3.00, rrp: 4.95, barcode: "9369998144198" },
  { name: "Double Chocolate Protein Bar 50g", supplier: "Fod Bods", category: "Protein Bars", size: "50g", carton_size: 10, wholesale_price: 3.00, rrp: 4.95, barcode: "9359133000144" },
  { name: "Hazelnut Mocha Protein Bar 50g", supplier: "Fod Bods", category: "Protein Bars", size: "50g", carton_size: 10, wholesale_price: 3.00, rrp: 4.95, barcode: "9359133000199" },
  { name: "Lemon Coconut Protein Bar 50g", supplier: "Fod Bods", category: "Protein Bars", size: "50g", carton_size: 10, wholesale_price: 3.00, rrp: 4.95, barcode: "9369998133604" },
  { name: "Peanut Choc Chunk Protein Bar 50g", supplier: "Fod Bods", category: "Protein Bars", size: "50g", carton_size: 10, wholesale_price: 3.00, rrp: 4.95, barcode: "9369998049080" },
  { name: "Mint Chocolate Mini 30g", supplier: "Fod Bods", category: "Protein Bars", size: "30g", carton_size: 12, wholesale_price: 2.30, rrp: 3.95, barcode: "9369998140268" },
  { name: "Raspberry Coconut Mini 30g", supplier: "Fod Bods", category: "Protein Bars", size: "30g", carton_size: 12, wholesale_price: 2.30, rrp: 3.95, barcode: "9369998063451" },
  { name: "Lamington Mini 30g", supplier: "Fod Bods", category: "Protein Bars", size: "30g", carton_size: 12, wholesale_price: 2.30, rrp: 3.95, barcode: "9359133000021" },
  { name: "Strawberry Shortcake Mini 30g", supplier: "Fod Bods", category: "Protein Bars", size: "30g", carton_size: 12, wholesale_price: 2.30, rrp: 3.95, barcode: "9359133000007" },

  // ============================================
  // FOX POPS - VEGAN SNACK
  // ============================================
  { name: "Fox Pops Himalayan Salt 28g", supplier: "Fox Pops", category: "Snacks", size: "28g", carton_size: 10, wholesale_price: 2.65, rrp: 4.35, barcode: "9369999927448" },
  { name: "Fox Pops Peanut Butter 28g", supplier: "Fox Pops", category: "Snacks", size: "28g", carton_size: 10, wholesale_price: 2.65, rrp: 4.35, barcode: "9369999340896" },
  { name: "Fox Pops Salt & Vinegar 28g", supplier: "Fox Pops", category: "Snacks", size: "28g", carton_size: 10, wholesale_price: 2.65, rrp: 4.35, barcode: "9369900015318" },
  { name: "Fox Pops Smoked Chilli 28g", supplier: "Fox Pops", category: "Snacks", size: "28g", carton_size: 10, wholesale_price: 2.65, rrp: 4.35, barcode: "9369999825973" },
  { name: "Fox Pops Sour Cream & Onion 28g", supplier: "Fox Pops", category: "Snacks", size: "28g", carton_size: 10, wholesale_price: 2.65, rrp: 4.35, barcode: "9369999630751" },

  // ============================================
  // ISLAND PASTA - PASTA & SAUCES
  // ============================================
  { name: "Casarecce Pasta 500g", supplier: "Island Pasta", category: "Pasta", size: "500g", carton_size: 12, wholesale_price: 6.00, rrp: 9.35, barcode: "0728990034590" },
  { name: "Conchiglie Pasta 500g", supplier: "Island Pasta", category: "Pasta", size: "500g", carton_size: 12, wholesale_price: 6.00, rrp: 9.35, barcode: "0728990034644" },
  { name: "Fusilli Pasta 500g", supplier: "Island Pasta", category: "Pasta", size: "500g", carton_size: 12, wholesale_price: 6.00, rrp: 9.35, barcode: "0728990034637" },
  { name: "Gnocchi Sardi Pasta 500g", supplier: "Island Pasta", category: "Pasta", size: "500g", carton_size: 12, wholesale_price: 6.00, rrp: 9.35, barcode: "0728990034613" },
  { name: "Mezzi Rigatoni Pasta 500g", supplier: "Island Pasta", category: "Pasta", size: "500g", carton_size: 12, wholesale_price: 6.00, rrp: 9.35, barcode: "0728990034583" },
  { name: "Orecchiette Pasta 500g", supplier: "Island Pasta", category: "Pasta", size: "500g", carton_size: 12, wholesale_price: 6.00, rrp: 9.35, barcode: "0786368776848" },
  { name: "Penne Rigate Pasta 500g", supplier: "Island Pasta", category: "Pasta", size: "500g", carton_size: 12, wholesale_price: 6.00, rrp: 9.35, barcode: "0786368776855" },
  { name: "Pappardelle Pasta 320g", supplier: "Island Pasta", category: "Pasta", size: "320g", carton_size: 12, wholesale_price: 6.00, rrp: 9.25, barcode: "0728990034620" },
  { name: "Tagliatelle Pasta 320g", supplier: "Island Pasta", category: "Pasta", size: "320g", carton_size: 12, wholesale_price: 6.00, rrp: 9.25, barcode: "0728990034743" },
  { name: "Cacio e Pepe Sauce 375g", supplier: "Island Pasta", category: "Pasta Sauces", size: "375g", carton_size: 6, wholesale_price: 14.00, rrp: 17.95, barcode: "0728990034576" },
  { name: "Puttanesca Sauce 500g", supplier: "Island Pasta", category: "Pasta Sauces", size: "500g", carton_size: 6, wholesale_price: 8.50, rrp: 11.95, barcode: "0728990034538" },
  { name: "Salsa All'Arrabbiata 480g", supplier: "Island Pasta", category: "Pasta Sauces", size: "480g", carton_size: 6, wholesale_price: 12.00, rrp: 15.95, barcode: "072899034552" },
  { name: "Salsa Bolognese 500g", supplier: "Island Pasta", category: "Pasta Sauces", size: "500g", carton_size: 6, wholesale_price: 14.00, rrp: 17.95, barcode: "0728990034682" },
  { name: "Salsa di Pomodoro 500g", supplier: "Island Pasta", category: "Pasta Sauces", size: "500g", carton_size: 6, wholesale_price: 8.50, rrp: 11.95, barcode: "0728990034521" },

  // ============================================
  // KOJA - HEALTHY SNACKING
  // ============================================
  { name: "KOJA Cacao Oat Bar 60g", supplier: "KOJA", category: "Snack Bars", size: "60g", carton_size: 12, wholesale_price: 2.22, rrp: 3.95, barcode: "9350551000143" },
  { name: "KOJA Cinnamon & Raisin Oat Bar 60g", supplier: "KOJA", category: "Snack Bars", size: "60g", carton_size: 12, wholesale_price: 2.22, rrp: 3.95, barcode: "9350551000150" },
  { name: "KOJA Dark Choc Chip Oat Bar 60g", supplier: "KOJA", category: "Snack Bars", size: "60g", carton_size: 12, wholesale_price: 2.22, rrp: 3.95, barcode: "9350551000136" },
  { name: "KOJA Lemon & Coconut Oat Bar 60g", supplier: "KOJA", category: "Snack Bars", size: "60g", carton_size: 12, wholesale_price: 2.22, rrp: 3.95, barcode: "9350551000129" },
  { name: "KOJA Maple Oat Bar 60g", supplier: "KOJA", category: "Snack Bars", size: "60g", carton_size: 12, wholesale_price: 2.22, rrp: 3.95, barcode: "9350551000112" },
  { name: "KOJA White Choc & Macadamia Oat Bar 60g", supplier: "KOJA", category: "Snack Bars", size: "60g", carton_size: 12, wholesale_price: 2.22, rrp: 3.95, barcode: "9350551000280" },
  { name: "KOJA Choc Berry Protein Bar 45g", supplier: "KOJA", category: "Protein Bars", size: "45g", carton_size: 16, wholesale_price: 2.54, rrp: 4.45, barcode: "9350551000600" },
  { name: "KOJA Double Chocolate Protein Bar 45g", supplier: "KOJA", category: "Protein Bars", size: "45g", carton_size: 16, wholesale_price: 2.54, rrp: 4.45, barcode: "9350551000617" },
  { name: "KOJA Peanut Fudge Protein Bar 45g", supplier: "KOJA", category: "Protein Bars", size: "45g", carton_size: 16, wholesale_price: 2.54, rrp: 4.45, barcode: "9350551000648" },

  // ============================================
  // KRUNCHILLI - CONDIMENT
  // ============================================
  { name: "Krunchilli Medium 350g", supplier: "Krunchilli", category: "Condiments", size: "350g", carton_size: 8, wholesale_price: 8.75, rrp: 12.95, barcode: "9358683000000" },
  { name: "Krunchilli Hot 350g", supplier: "Krunchilli", category: "Condiments", size: "350g", carton_size: 8, wholesale_price: 8.75, rrp: 12.95, barcode: "9358683000017" },
  { name: "Krunchilli Carolina Extra Hot 350g", supplier: "Krunchilli", category: "Condiments", size: "350g", carton_size: 8, wholesale_price: 12.00, rrp: 17.45, barcode: "9358683000086" },

  // ============================================
  // LANI'S - ROCKY ROAD
  // ============================================
  { name: "Lani's Milk Original Rocky Road 90g", supplier: "Lani's", category: "Confectionery", size: "90g", carton_size: 10, wholesale_price: 4.00, rrp: 5.99, barcode: "0787099981723" },
  { name: "Lani's Milk Nut Free Rocky Road 90g", supplier: "Lani's", category: "Confectionery", size: "90g", carton_size: 10, wholesale_price: 4.00, rrp: 5.99, barcode: "0787099981716" },
  { name: "Lani's Dark Original Rocky Road 90g", supplier: "Lani's", category: "Confectionery", size: "90g", carton_size: 10, wholesale_price: 4.00, rrp: 5.99 },
  { name: "Lani's Dark Nut Free Rocky Road 90g", supplier: "Lani's", category: "Confectionery", size: "90g", carton_size: 10, wholesale_price: 4.00, rrp: 5.99 },
  { name: "Lani's White Original Rocky Road 90g", supplier: "Lani's", category: "Confectionery", size: "90g", carton_size: 10, wholesale_price: 4.00, rrp: 5.99 },
  { name: "Lani's White Nut Free Rocky Road 90g", supplier: "Lani's", category: "Confectionery", size: "90g", carton_size: 10, wholesale_price: 4.00, rrp: 5.99 },

  // ============================================
  // KEATING & CO - CONDIMENTS
  // ============================================
  { name: "The Lankan Lion Hot Sauce 250ml", supplier: "Keating & Co", category: "Hot Sauces", size: "250ml", carton_size: 12, wholesale_price: 11.85, rrp: 17.95, barcode: "9309001013004" },
  { name: "Mad Mango Hot Sauce 250ml", supplier: "Keating & Co", category: "Hot Sauces", size: "250ml", carton_size: 12, wholesale_price: 11.85, rrp: 17.95, barcode: "9369998028054" },
  { name: "Cherry Champion Hot Sauce 250ml", supplier: "Keating & Co", category: "Hot Sauces", size: "250ml", carton_size: 12, wholesale_price: 11.85, rrp: 17.95, barcode: "9369998184507" },
  { name: "The X-Turminator Hot Sauce 250ml", supplier: "Keating & Co", category: "Hot Sauces", size: "250ml", carton_size: 12, wholesale_price: 11.85, rrp: 17.95, barcode: "9369998183579" },
  { name: "Cap'n Cayenne Hot Sauce 250ml", supplier: "Keating & Co", category: "Hot Sauces", size: "250ml", carton_size: 12, wholesale_price: 11.85, rrp: 17.95, barcode: "9369998025602" },
  { name: "Jalapeno Jitman Hot Sauce 250ml", supplier: "Keating & Co", category: "Hot Sauces", size: "250ml", carton_size: 12, wholesale_price: 11.85, rrp: 17.95, barcode: "9369998121663" },
  { name: "The Reaper Hot Sauce 250ml", supplier: "Keating & Co", category: "Hot Sauces", size: "250ml", carton_size: 12, wholesale_price: 11.85, rrp: 17.95, barcode: "9369998190614" },

  // ============================================
  // MELBOURNE CHILLI CO
  // ============================================
  { name: "Chilli Oil Mild 250ml", supplier: "Melbourne Chilli Co.", category: "Condiments", size: "250ml", carton_size: 12, wholesale_price: 12.00, rrp: 17.95, barcode: "93699993353735" },
  { name: "Chilli Oil Hot 250ml", supplier: "Melbourne Chilli Co.", category: "Condiments", size: "250ml", carton_size: 12, wholesale_price: 12.00, rrp: 17.95, barcode: "9369900054584" },
  { name: "Chilli Honey Hot 350ml", supplier: "Melbourne Chilli Co.", category: "Condiments", size: "350ml", carton_size: 12, wholesale_price: 10.00, rrp: 16.45, barcode: "9369998522040" },

  // ============================================
  // MIXED BAG - CHAI & DRINKING CHOCOLATE
  // ============================================
  { name: "Original Sticky Chai 80g", supplier: "Mixed Bag", category: "Beverages", size: "80g", carton_size: 10, wholesale_price: 7.50, rrp: 11.95, barcode: "9357350000008" },
  { name: "Original Sticky Chai Large 250g", supplier: "Mixed Bag", category: "Beverages", size: "250g", carton_size: 10, wholesale_price: 15.50, rrp: 24.95, barcode: "9369998077137" },
  { name: "Coconut Blossom Chai 80g", supplier: "Mixed Bag", category: "Beverages", size: "80g", carton_size: 10, wholesale_price: 7.50, rrp: 11.95, barcode: "9357350000022" },
  { name: "Orange Spiced Chai 80g", supplier: "Mixed Bag", category: "Beverages", size: "80g", carton_size: 10, wholesale_price: 7.50, rrp: 11.95, barcode: "9357350000015" },
  { name: "Original Drinking Chocolate 80g", supplier: "Mixed Bag", category: "Beverages", size: "80g", carton_size: 10, wholesale_price: 7.00, rrp: 10.95, barcode: "9357350000039" },
  { name: "Mint Drinking Chocolate 80g", supplier: "Mixed Bag", category: "Beverages", size: "80g", carton_size: 10, wholesale_price: 7.00, rrp: 10.95, barcode: "9357350000046" },

  // ============================================
  // PENNY'S - PORK CRACKLING
  // ============================================
  { name: "Penny's Pork Crackling Original 35g", supplier: "Penny's", category: "Snacks", size: "35g", carton_size: 12, wholesale_price: 3.10, rrp: 4.95, barcode: "0793573027047" },
  { name: "Penny's Pork Crackling Original Large 140g", supplier: "Penny's", category: "Snacks", size: "140g", carton_size: 6, wholesale_price: 7.05, rrp: 10.75, barcode: "0680596875796" },
  { name: "Penny's Pork Crackling BBQ 35g", supplier: "Penny's", category: "Snacks", size: "35g", carton_size: 12, wholesale_price: 3.10, rrp: 4.95, barcode: "0706502754921" },
  { name: "Penny's Pork Crackling BBQ Large 140g", supplier: "Penny's", category: "Snacks", size: "140g", carton_size: 6, wholesale_price: 7.05, rrp: 10.75, barcode: "0706502754938" },
  { name: "Penny's Pork Crackling Chilli 35g", supplier: "Penny's", category: "Snacks", size: "35g", carton_size: 12, wholesale_price: 3.10, rrp: 4.95, barcode: "0793570027030" },
  { name: "Penny's Pork Crackling Chilli Large 140g", supplier: "Penny's", category: "Snacks", size: "140g", carton_size: 6, wholesale_price: 7.05, rrp: 10.75, barcode: "0680596875802" },

  // ============================================
  // PISTABELLA - PISTACHIO SPREAD
  // ============================================
  { name: "Pistabella Pistachio Spread 200g", supplier: "Pistabella", category: "Spreads", size: "200g", carton_size: 12, wholesale_price: 14.49, rrp: 20.49, barcode: "9369900068161" },

  // ============================================
  // SAD GIRL - MATCHA
  // ============================================
  { name: "Sad Girl Matcha Pretzels 100g", supplier: "Sad Girl", category: "Snacks", size: "100g", carton_size: 6, wholesale_price: 5.50, rrp: 7.95, barcode: "9369900083645" },
  { name: "Silky Matcha Spread 240g", supplier: "Sad Girl", category: "Spreads", size: "240g", carton_size: 12, wholesale_price: 14.50, rrp: 21.95, barcode: "9369900072281" },

  // ============================================
  // SCHULTE'S - BACON JERKY
  // ============================================
  { name: "Schulte's Original Bacon Jerky 50g", supplier: "Schulte's", category: "Jerky", size: "50g", carton_size: 6, wholesale_price: 6.25, rrp: 9.95 },
  { name: "Schulte's Maple Bacon Jerky 50g", supplier: "Schulte's", category: "Jerky", size: "50g", carton_size: 6, wholesale_price: 6.25, rrp: 9.95 },

  // ============================================
  // SIX BARREL SODA
  // ============================================
  { name: "Celery Tonic Syrup 500ml", supplier: "Six Barrel Soda", category: "Beverages", size: "500ml", carton_size: 6, wholesale_price: 10.02, rrp: 16.95, barcode: "9421906872309" },
  { name: "Cherry & Pomegranate Syrup 500ml", supplier: "Six Barrel Soda", category: "Beverages", size: "500ml", carton_size: 6, wholesale_price: 10.02, rrp: 16.95, barcode: "9421906872347" },
  { name: "Classic Tonic Syrup 500ml", supplier: "Six Barrel Soda", category: "Beverages", size: "500ml", carton_size: 6, wholesale_price: 10.02, rrp: 16.95, barcode: "9421906872279" },
  { name: "Cola Six Syrup 500ml", supplier: "Six Barrel Soda", category: "Beverages", size: "500ml", carton_size: 6, wholesale_price: 10.02, rrp: 16.95, barcode: "9421906872323" },
  { name: "Elderflower Syrup 500ml", supplier: "Six Barrel Soda", category: "Beverages", size: "500ml", carton_size: 6, wholesale_price: 10.02, rrp: 16.95, barcode: "9421906872132" },
  { name: "Ginger Ale Syrup 500ml", supplier: "Six Barrel Soda", category: "Beverages", size: "500ml", carton_size: 6, wholesale_price: 10.02, rrp: 16.95, barcode: "9421906872330" },
  { name: "Hibiscus Syrup 500ml", supplier: "Six Barrel Soda", category: "Beverages", size: "500ml", carton_size: 6, wholesale_price: 10.02, rrp: 16.95, barcode: "9421906872262" },
  { name: "Lemon Honey Ginger Syrup 500ml", supplier: "Six Barrel Soda", category: "Beverages", size: "500ml", carton_size: 6, wholesale_price: 10.02, rrp: 16.95, barcode: "9421906872286" },
  { name: "Lemonade Syrup 500ml", supplier: "Six Barrel Soda", category: "Beverages", size: "500ml", carton_size: 6, wholesale_price: 10.02, rrp: 16.95, barcode: "9421906872354" },

  // ============================================
  // TRUCKIN' GOOD - JERKY
  // ============================================
  { name: "Truckin' Good Traditional Jerky 35g", supplier: "Truckin' Good", category: "Jerky", size: "35g", carton_size: 12, wholesale_price: 4.20, rrp: 6.45, barcode: "9325749000397" },
  { name: "Truckin' Good Traditional Jerky Large 100g", supplier: "Truckin' Good", category: "Jerky", size: "100g", carton_size: 6, wholesale_price: 9.85, rrp: 13.95, barcode: "9325749000779" },
  { name: "Truckin' Good Smokey Jerky 35g", supplier: "Truckin' Good", category: "Jerky", size: "35g", carton_size: 12, wholesale_price: 4.20, rrp: 6.45, barcode: "9325749000410" },
  { name: "Truckin' Good Smokey Jerky Large 100g", supplier: "Truckin' Good", category: "Jerky", size: "100g", carton_size: 6, wholesale_price: 9.85, rrp: 13.95, barcode: "9325749000762" },
  { name: "Truckin' Good Chilli Jerky 35g", supplier: "Truckin' Good", category: "Jerky", size: "35g", carton_size: 12, wholesale_price: 4.20, rrp: 6.45, barcode: "9325749000403" },
  { name: "Truckin' Good Chilli Jerky Large 100g", supplier: "Truckin' Good", category: "Jerky", size: "100g", carton_size: 6, wholesale_price: 9.85, rrp: 13.95, barcode: "9325749000755" },
  { name: "Truckin' Good Mango Chilli Jerky 35g", supplier: "Truckin' Good", category: "Jerky", size: "35g", carton_size: 12, wholesale_price: 4.20, rrp: 6.45, barcode: "9325749000854" },
  { name: "Truckin' Good Mango Chilli Jerky Large 100g", supplier: "Truckin' Good", category: "Jerky", size: "100g", carton_size: 6, wholesale_price: 9.85, rrp: 13.95, barcode: "9325749000861" },

  // ============================================
  // TUCK SHOP SAUCE CO
  // ============================================
  { name: "Tuck Shop Burger Sauce 265g", supplier: "Tuck Shop Sauce Co.", category: "Sauces", size: "265g", carton_size: 9, wholesale_price: 7.00, rrp: 10.95, barcode: "0754590304924" },
  { name: "Tuck Shop Pickle X Burger Sauce 265g", supplier: "Tuck Shop Sauce Co.", category: "Sauces", size: "265g", carton_size: 9, wholesale_price: 7.90, rrp: 11.95, barcode: "9355629004108" },
  { name: "Tuck Shop Smoked Jalapeno Sauce 265g", supplier: "Tuck Shop Sauce Co.", category: "Sauces", size: "265g", carton_size: 9, wholesale_price: 9.00, rrp: 13.95, barcode: "0754590304931" },
  { name: "Tuck Shop Tomato Sauce 560g", supplier: "Tuck Shop Sauce Co.", category: "Sauces", size: "560g", carton_size: 9, wholesale_price: 7.00, rrp: 10.95, barcode: "0754590304948" },

  // ============================================
  // UNCLE JOHN'S - LICORICE
  // ============================================
  { name: "Uncle John's Plain Molasses Licorice 300g", supplier: "Uncle John's", category: "Confectionery", size: "300g", carton_size: 12, wholesale_price: 2.90, rrp: 5.95, barcode: "9322633000112" },
  { name: "Uncle John's Chocolate Coated Licorice 300g", supplier: "Uncle John's", category: "Confectionery", size: "300g", carton_size: 12, wholesale_price: 3.60, rrp: 7.45, barcode: "9322633000129" },

  // ============================================
  // WINTULICHS - SMALLGOODS
  // ============================================
  { name: "Wintulichs Smokey BBQ Bier Stick 50g", supplier: "Wintulichs", category: "Smallgoods", size: "50g", carton_size: 20, wholesale_price: 2.75, rrp: 4.00, barcode: "9311007200029" },
  { name: "Wintulichs Hot Chilli Bier Stick 50g", supplier: "Wintulichs", category: "Smallgoods", size: "50g", carton_size: 20, wholesale_price: 2.75, rrp: 4.00, barcode: "9311007200050" },
  { name: "Wintulichs Chorizo Bier Stick 50g", supplier: "Wintulichs", category: "Smallgoods", size: "50g", carton_size: 20, wholesale_price: 2.75, rrp: 4.00, barcode: "9311007200036" },
  { name: "Wintulichs Garlic Bier Stick 50g", supplier: "Wintulichs", category: "Smallgoods", size: "50g", carton_size: 20, wholesale_price: 2.75, rrp: 4.00, barcode: "9311007200043" },
  { name: "Wintulichs Hungarian Bier Stick 50g", supplier: "Wintulichs", category: "Smallgoods", size: "50g", carton_size: 20, wholesale_price: 2.75, rrp: 4.00, barcode: "9311007200067" },

  // ============================================
  // ZERO BITES - ORGANIC OAT CLUSTERS
  // ============================================
  { name: "Zero Bites Oat Clusters 200g", supplier: "Zero Bites", category: "Snacks", size: "200g", carton_size: 12, wholesale_price: 8.99, rrp: 12.45, barcode: "0080687337910" },
  { name: "Zero Bites Cacao Oat Clusters 200g", supplier: "Zero Bites", category: "Snacks", size: "200g", carton_size: 12, wholesale_price: 8.99, rrp: 12.45, barcode: "0806809014978" },
];

export default PRODUCTS;
