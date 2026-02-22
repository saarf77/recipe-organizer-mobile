/**
 * Sample recipes shown to new users on first install.
 * Covers all 6 home categories so every tile leads somewhere.
 * Marked with is_sample = true so users can distinguish them.
 */

export interface SeedIngredient {
  name: string;
  quantity: string | null;
  unit: string | null;
}

export interface SeedStep {
  instruction: string;
}

export interface SeedRecipe {
  title: string;
  description: string;
  category: string;
  cuisine: string;
  difficulty: 'easy' | 'medium' | 'hard';
  prep_time_minutes: number;
  cook_time_minutes: number;
  servings: number;
  tags: string[];
  imageUrl?: string;
  ingredients: SeedIngredient[];
  steps: SeedStep[];
}

export const SEED_RECIPES: SeedRecipe[] = [
  // ─── Breakfast ─────────────────────────────────────────────────────────────
  {
    title: 'Classic Avocado Toast',
    description: 'Creamy mashed avocado on toasted sourdough with a perfectly poached egg.',
    category: 'Breakfast',
    cuisine: 'American',
    difficulty: 'easy',
    prep_time_minutes: 5,
    cook_time_minutes: 10,
    servings: 1,
    tags: ['vegetarian'],
    imageUrl: 'https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?w=800&h=600&fit=crop&auto=format&q=80',
    ingredients: [
      { name: 'Sourdough bread', quantity: '2', unit: 'slices' },
      { name: 'Ripe avocado', quantity: '1', unit: null },
      { name: 'Egg', quantity: '1', unit: 'large' },
      { name: 'Lemon juice', quantity: '1', unit: 'tsp' },
      { name: 'Red pepper flakes', quantity: null, unit: null },
      { name: 'Salt & pepper', quantity: null, unit: null },
    ],
    steps: [
      { instruction: 'Toast the sourdough slices until golden and crisp.' },
      { instruction: 'Halve and pit the avocado. Scoop into a bowl, add lemon juice, salt, and pepper. Mash with a fork to your preferred texture.' },
      { instruction: 'Bring a small saucepan of water to a gentle simmer. Create a gentle swirl, crack the egg in, and poach for 3 minutes.' },
      { instruction: 'Spread mashed avocado over the toast. Top with the poached egg and a pinch of red pepper flakes.' },
    ],
  },
  {
    title: 'Fluffy Banana Pancakes',
    description: 'Light, fluffy pancakes with natural sweetness from ripe bananas.',
    category: 'Breakfast',
    cuisine: 'American',
    difficulty: 'easy',
    prep_time_minutes: 10,
    cook_time_minutes: 15,
    servings: 2,
    tags: ['vegetarian'],
    imageUrl: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&h=600&fit=crop&auto=format&q=80',
    ingredients: [
      { name: 'Ripe banana', quantity: '2', unit: null },
      { name: 'Eggs', quantity: '2', unit: 'large' },
      { name: 'All-purpose flour', quantity: '1', unit: 'cup' },
      { name: 'Milk', quantity: '3/4', unit: 'cup' },
      { name: 'Baking powder', quantity: '1', unit: 'tsp' },
      { name: 'Vanilla extract', quantity: '1', unit: 'tsp' },
      { name: 'Butter', quantity: '1', unit: 'tbsp' },
    ],
    steps: [
      { instruction: 'Mash bananas in a large bowl until smooth.' },
      { instruction: 'Add eggs, milk, and vanilla. Whisk together.' },
      { instruction: 'Fold in flour and baking powder until just combined — a few lumps are fine.' },
      { instruction: 'Melt butter in a non-stick pan over medium heat. Pour ¼ cup batter per pancake. Cook 2–3 min until bubbles form, then flip and cook 1 more minute.' },
      { instruction: 'Serve with maple syrup and sliced banana.' },
    ],
  },

  // ─── Lunch ─────────────────────────────────────────────────────────────────
  {
    title: 'Mediterranean Chicken Wrap',
    description: 'Juicy grilled chicken with tzatziki, cucumber, and feta in a warm tortilla.',
    category: 'Lunch',
    cuisine: 'Mediterranean',
    difficulty: 'easy',
    prep_time_minutes: 15,
    cook_time_minutes: 12,
    servings: 2,
    tags: [],
    imageUrl: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&h=600&fit=crop&auto=format&q=80',
    ingredients: [
      { name: 'Chicken breast', quantity: '300', unit: 'g' },
      { name: 'Large flour tortillas', quantity: '2', unit: null },
      { name: 'Tzatziki', quantity: '4', unit: 'tbsp' },
      { name: 'Cucumber', quantity: '1/2', unit: null },
      { name: 'Cherry tomatoes', quantity: '8', unit: null },
      { name: 'Feta cheese', quantity: '50', unit: 'g' },
      { name: 'Mixed greens', quantity: '1', unit: 'handful' },
      { name: 'Olive oil', quantity: '1', unit: 'tbsp' },
      { name: 'Dried oregano', quantity: '1', unit: 'tsp' },
    ],
    steps: [
      { instruction: 'Slice chicken into strips. Toss with olive oil, oregano, salt, and pepper.' },
      { instruction: 'Grill or pan-fry chicken over high heat for 5–6 minutes per side until cooked through.' },
      { instruction: 'Warm tortillas in a dry pan for 30 seconds each side.' },
      { instruction: 'Spread tzatziki over each tortilla. Layer on greens, cucumber slices, halved tomatoes, chicken, and crumbled feta.' },
      { instruction: 'Roll tightly, slice in half, and serve immediately.' },
    ],
  },
  {
    title: 'Tomato Basil Soup',
    description: 'Rich, velvety tomato soup with fresh basil and a drizzle of cream.',
    category: 'Lunch',
    cuisine: 'Italian',
    difficulty: 'easy',
    prep_time_minutes: 10,
    cook_time_minutes: 25,
    servings: 4,
    tags: ['vegetarian', 'gluten-free'],
    imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&h=600&fit=crop&auto=format&q=80',
    ingredients: [
      { name: 'Canned crushed tomatoes', quantity: '800', unit: 'g' },
      { name: 'Onion', quantity: '1', unit: 'medium' },
      { name: 'Garlic', quantity: '3', unit: 'cloves' },
      { name: 'Vegetable stock', quantity: '500', unit: 'ml' },
      { name: 'Heavy cream', quantity: '4', unit: 'tbsp' },
      { name: 'Fresh basil', quantity: '1', unit: 'handful' },
      { name: 'Olive oil', quantity: '2', unit: 'tbsp' },
      { name: 'Sugar', quantity: '1', unit: 'tsp' },
    ],
    steps: [
      { instruction: 'Dice onion and mince garlic. Sauté in olive oil over medium heat for 5 minutes until soft.' },
      { instruction: 'Add crushed tomatoes, stock, and sugar. Bring to a boil then simmer 15 minutes.' },
      { instruction: 'Add most of the basil, reserving a few leaves for garnish. Blend until smooth with an immersion blender.' },
      { instruction: 'Season with salt and pepper. Serve with a drizzle of cream and fresh basil.' },
    ],
  },

  // ─── Dinner ────────────────────────────────────────────────────────────────
  {
    title: 'Spaghetti Carbonara',
    description: 'A Roman classic — silky egg and pecorino sauce with crispy guanciale. No cream.',
    category: 'Dinner',
    cuisine: 'Italian',
    difficulty: 'medium',
    prep_time_minutes: 10,
    cook_time_minutes: 20,
    servings: 2,
    tags: [],
    imageUrl: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800&h=600&fit=crop&auto=format&q=80',
    ingredients: [
      { name: 'Spaghetti', quantity: '200', unit: 'g' },
      { name: 'Guanciale or pancetta', quantity: '150', unit: 'g' },
      { name: 'Eggs', quantity: '2', unit: 'large' },
      { name: 'Egg yolks', quantity: '2', unit: null },
      { name: 'Pecorino Romano', quantity: '80', unit: 'g' },
      { name: 'Black pepper', quantity: null, unit: null },
    ],
    steps: [
      { instruction: 'Bring a large pot of salted water to a boil. Cook spaghetti until al dente, reserving 1 cup pasta water before draining.' },
      { instruction: 'Meanwhile, cut guanciale into small cubes and cook in a cold pan over medium heat until fat renders and it becomes golden.' },
      { instruction: 'In a bowl, whisk together eggs, yolks, and grated pecorino. Season generously with black pepper.' },
      { instruction: 'Add hot pasta to the pan with guanciale (off the heat). Quickly pour in the egg mixture, tossing constantly. Add pasta water a splash at a time to create a creamy sauce.' },
      { instruction: 'Serve immediately with extra pecorino and black pepper.' },
    ],
  },
  {
    title: 'Sheet Pan Lemon Herb Salmon',
    description: 'Tender salmon fillets roasted with asparagus and a bright lemon-herb glaze.',
    category: 'Dinner',
    cuisine: 'American',
    difficulty: 'easy',
    prep_time_minutes: 10,
    cook_time_minutes: 18,
    servings: 2,
    tags: ['gluten-free'],
    imageUrl: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&h=600&fit=crop&auto=format&q=80',
    ingredients: [
      { name: 'Salmon fillets', quantity: '2', unit: '170g each' },
      { name: 'Asparagus', quantity: '200', unit: 'g' },
      { name: 'Lemon', quantity: '1', unit: null },
      { name: 'Garlic', quantity: '2', unit: 'cloves' },
      { name: 'Fresh dill', quantity: '2', unit: 'tbsp' },
      { name: 'Olive oil', quantity: '2', unit: 'tbsp' },
      { name: 'Dijon mustard', quantity: '1', unit: 'tsp' },
    ],
    steps: [
      { instruction: 'Preheat oven to 200°C (400°F). Line a baking sheet with foil.' },
      { instruction: 'Mix olive oil, minced garlic, dill, lemon zest, and Dijon mustard into a glaze.' },
      { instruction: 'Trim asparagus and arrange on the sheet. Place salmon fillets on top. Brush both generously with glaze.' },
      { instruction: 'Roast 15–18 minutes until salmon flakes easily. Squeeze fresh lemon juice over before serving.' },
    ],
  },

  // ─── Desserts ──────────────────────────────────────────────────────────────
  {
    title: 'Chocolate Lava Cake',
    description: 'Warm, individual chocolate cakes with a molten centre. Ready in 20 minutes.',
    category: 'Desserts',
    cuisine: 'French',
    difficulty: 'medium',
    prep_time_minutes: 10,
    cook_time_minutes: 12,
    servings: 2,
    tags: ['vegetarian'],
    imageUrl: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&h=600&fit=crop&auto=format&q=80',
    ingredients: [
      { name: 'Dark chocolate (70%)', quantity: '100', unit: 'g' },
      { name: 'Butter', quantity: '80', unit: 'g' },
      { name: 'Eggs', quantity: '2', unit: 'large' },
      { name: 'Egg yolks', quantity: '2', unit: null },
      { name: 'Caster sugar', quantity: '60', unit: 'g' },
      { name: 'All-purpose flour', quantity: '2', unit: 'tbsp' },
    ],
    steps: [
      { instruction: 'Preheat oven to 220°C (425°F). Grease and flour 2 ramekins.' },
      { instruction: 'Melt chocolate and butter together in a heatproof bowl over simmering water (or microwave in 30-second bursts). Let cool slightly.' },
      { instruction: 'Whisk eggs, yolks, and sugar together until pale. Fold in the chocolate mixture, then fold in flour.' },
      { instruction: 'Divide batter between ramekins. Bake 10–12 minutes until the edges are set but the centre still jiggles.' },
      { instruction: 'Run a knife around the edge, invert onto a plate and serve immediately with vanilla ice cream.' },
    ],
  },
  {
    title: 'Greek Yogurt Parfait',
    description: 'Layers of creamy yogurt, fresh berries, honey, and crunchy granola.',
    category: 'Desserts',
    cuisine: 'American',
    difficulty: 'easy',
    prep_time_minutes: 5,
    cook_time_minutes: 0,
    servings: 1,
    tags: ['vegetarian', 'gluten-free'],
    imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&h=600&fit=crop&auto=format&q=80',
    ingredients: [
      { name: 'Greek yogurt', quantity: '200', unit: 'g' },
      { name: 'Mixed berries', quantity: '100', unit: 'g' },
      { name: 'Granola', quantity: '4', unit: 'tbsp' },
      { name: 'Honey', quantity: '2', unit: 'tsp' },
      { name: 'Vanilla extract', quantity: '1/4', unit: 'tsp' },
    ],
    steps: [
      { instruction: 'Mix yogurt with vanilla extract.' },
      { instruction: 'In a glass, layer half the yogurt, then half the berries, then half the granola. Repeat.' },
      { instruction: 'Drizzle honey over the top and serve immediately.' },
    ],
  },

  // ─── Snacks ────────────────────────────────────────────────────────────────
  {
    title: 'Crispy Chickpea Bowl',
    description: 'Oven-roasted chickpeas with smoked paprika — a satisfying, high-protein snack.',
    category: 'Snacks',
    cuisine: 'American',
    difficulty: 'easy',
    prep_time_minutes: 5,
    cook_time_minutes: 30,
    servings: 2,
    tags: ['vegan', 'gluten-free'],
    imageUrl: 'https://images.unsplash.com/photo-1521763069287-579ca77694e8?w=800&h=600&fit=crop&auto=format&q=80',
    ingredients: [
      { name: 'Canned chickpeas', quantity: '400', unit: 'g' },
      { name: 'Olive oil', quantity: '2', unit: 'tbsp' },
      { name: 'Smoked paprika', quantity: '1', unit: 'tsp' },
      { name: 'Cumin', quantity: '1/2', unit: 'tsp' },
      { name: 'Garlic powder', quantity: '1/2', unit: 'tsp' },
      { name: 'Salt', quantity: null, unit: null },
    ],
    steps: [
      { instruction: 'Preheat oven to 200°C (400°F). Drain, rinse, and pat chickpeas very dry with paper towels.' },
      { instruction: 'Toss chickpeas with olive oil, paprika, cumin, garlic powder, and salt.' },
      { instruction: 'Spread in a single layer on a baking sheet. Roast 25–30 minutes, shaking halfway, until golden and crisp.' },
      { instruction: 'Let cool 5 minutes — they crisp up further as they cool.' },
    ],
  },
  {
    title: 'Guacamole & Tortilla Chips',
    description: 'Classic fresh guacamole ready in 10 minutes — chunky, bright, and addictive.',
    category: 'Snacks',
    cuisine: 'Mexican',
    difficulty: 'easy',
    prep_time_minutes: 10,
    cook_time_minutes: 0,
    servings: 4,
    tags: ['vegan', 'gluten-free'],
    imageUrl: 'https://plus.unsplash.com/premium_photo-1681406689585-0b0c2e02ec44?w=800&h=600&fit=crop&auto=format&q=80',
    ingredients: [
      { name: 'Ripe avocados', quantity: '3', unit: null },
      { name: 'Lime', quantity: '1', unit: null },
      { name: 'Red onion', quantity: '1/4', unit: 'small' },
      { name: 'Jalapeño', quantity: '1/2', unit: null },
      { name: 'Fresh coriander', quantity: '2', unit: 'tbsp' },
      { name: 'Garlic', quantity: '1', unit: 'clove' },
      { name: 'Salt', quantity: null, unit: null },
      { name: 'Tortilla chips', quantity: null, unit: 'to serve' },
    ],
    steps: [
      { instruction: 'Halve and pit avocados. Scoop flesh into a bowl.' },
      { instruction: 'Finely dice red onion, jalapeño, and coriander. Mince garlic.' },
      { instruction: 'Add lime juice, onion, jalapeño, coriander, and garlic to the avocado. Mash to your preferred consistency.' },
      { instruction: 'Season with salt. Taste and adjust lime. Serve immediately with tortilla chips.' },
    ],
  },

  // ─── Drinks ────────────────────────────────────────────────────────────────
  {
    title: 'Mango Lassi',
    description: 'Thick, chilled mango and yogurt smoothie — sweet, tangy, and refreshing.',
    category: 'Drinks',
    cuisine: 'Indian',
    difficulty: 'easy',
    prep_time_minutes: 5,
    cook_time_minutes: 0,
    servings: 2,
    tags: ['vegetarian', 'gluten-free'],
    imageUrl: 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=800&h=600&fit=crop&auto=format&q=80',
    ingredients: [
      { name: 'Ripe mango (or frozen)', quantity: '300', unit: 'g' },
      { name: 'Plain yogurt', quantity: '200', unit: 'g' },
      { name: 'Milk', quantity: '150', unit: 'ml' },
      { name: 'Honey', quantity: '1', unit: 'tbsp' },
      { name: 'Cardamom', quantity: '1/4', unit: 'tsp' },
      { name: 'Ice cubes', quantity: '6', unit: null },
    ],
    steps: [
      { instruction: 'Peel and dice mango, removing the stone.' },
      { instruction: 'Add all ingredients to a blender. Blend on high until completely smooth.' },
      { instruction: 'Taste and add more honey if needed. Pour into chilled glasses and serve immediately.' },
    ],
  },
  {
    title: 'Mint Lemonade',
    description: 'Freshly squeezed lemonade blended with cooling mint. Perfect for summer.',
    category: 'Drinks',
    cuisine: 'American',
    difficulty: 'easy',
    prep_time_minutes: 10,
    cook_time_minutes: 5,
    servings: 4,
    tags: ['vegan', 'gluten-free'],
    imageUrl: 'https://images.unsplash.com/photo-1523677011781-c91d1bbe2f9e?w=800&h=600&fit=crop&auto=format&q=80',
    ingredients: [
      { name: 'Lemons', quantity: '4', unit: 'large' },
      { name: 'Fresh mint leaves', quantity: '20', unit: null },
      { name: 'Sugar', quantity: '80', unit: 'g' },
      { name: 'Water', quantity: '1', unit: 'litre' },
      { name: 'Ice', quantity: null, unit: 'to serve' },
    ],
    steps: [
      { instruction: 'Make a simple syrup: combine sugar and 100ml water in a saucepan over medium heat, stirring until dissolved. Remove from heat.' },
      { instruction: 'Add mint leaves to the warm syrup and let steep for 5 minutes. Strain out leaves.' },
      { instruction: 'Juice all lemons. Combine juice, mint syrup, and remaining cold water in a pitcher.' },
      { instruction: 'Stir well, taste, and adjust sweetness. Serve over ice with a sprig of mint.' },
    ],
  },
];
