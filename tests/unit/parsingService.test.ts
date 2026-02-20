import {
  detectTitle,
  detectTimes,
  detectServings,
  detectIngredientLines,
  detectSteps,
  estimateDifficulty,
  parseRecipeText,
} from '@/services/parsingService';

const SAMPLE_RECIPE = `
Classic Spaghetti Carbonara

Prep time: 10 minutes
Cook time: 20 minutes
Serves: 4

Ingredients:
- 400g spaghetti
- 200g pancetta
- 4 large eggs
- 100g Pecorino Romano
- 2 cloves garlic
- Black pepper to taste
- Salt to taste

Instructions:
1. Bring a large pot of salted water to boil.
2. Cook spaghetti according to package directions.
3. Meanwhile, fry pancetta in a pan until crispy.
4. Whisk eggs with grated Pecorino Romano.
5. Drain pasta, reserving 1 cup pasta water.
6. Add pasta to pan with pancetta, remove from heat.
7. Pour egg mixture over pasta, tossing quickly.
8. Add pasta water as needed to create creamy sauce.
9. Season with black pepper and serve immediately.
`;

describe('parsingService', () => {
  describe('detectTitle', () => {
    it('extracts the recipe title from the first meaningful line', () => {
      expect(detectTitle(SAMPLE_RECIPE)).toBe('Classic Spaghetti Carbonara');
    });

    it('returns null for empty text', () => {
      expect(detectTitle('')).toBeNull();
    });
  });

  describe('detectTimes', () => {
    it('extracts prep and cook times correctly', () => {
      const { prep, cook } = detectTimes(SAMPLE_RECIPE);
      expect(prep).toBe(10);
      expect(cook).toBe(20);
    });

    it('converts hours to minutes', () => {
      const { prep, cook } = detectTimes('Prep time: 1 hour\nCook time: 2 hours');
      expect(prep).toBe(60);
      expect(cook).toBe(120);
    });

    it('returns null when no times found', () => {
      const { prep, cook } = detectTimes('This is a recipe with no times');
      expect(prep).toBeNull();
      expect(cook).toBeNull();
    });
  });

  describe('detectServings', () => {
    it('extracts servings number', () => {
      expect(detectServings(SAMPLE_RECIPE)).toBe(4);
    });

    it('averages a range', () => {
      expect(detectServings('Serves 4-6 people')).toBe(5);
    });

    it('returns null when not found', () => {
      expect(detectServings('No servings info here')).toBeNull();
    });
  });

  describe('detectIngredientLines', () => {
    it('extracts all ingredients', () => {
      const ings = detectIngredientLines(SAMPLE_RECIPE);
      expect(ings.length).toBeGreaterThan(0);
      const names = ings.map((i) => i.name);
      expect(names.some((n) => n.toLowerCase().includes('spaghetti'))).toBe(true);
    });

    it('sets correct positions', () => {
      const ings = detectIngredientLines(SAMPLE_RECIPE);
      ings.forEach((ing, idx) => {
        expect(ing.position).toBe(idx);
      });
    });
  });

  describe('detectSteps', () => {
    it('extracts numbered steps', () => {
      const steps = detectSteps(SAMPLE_RECIPE);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps[0]).toContain('salted water');
    });
  });

  describe('estimateDifficulty', () => {
    it('returns easy for simple recipes', () => {
      expect(estimateDifficulty(4, 3, 20)).toBe('easy');
    });

    it('returns hard for complex recipes', () => {
      expect(estimateDifficulty(15, 12, 120)).toBe('hard');
    });

    it('returns medium for moderate recipes', () => {
      expect(estimateDifficulty(8, 7, 45)).toBe('medium');
    });
  });

  describe('parseRecipeText', () => {
    it('returns a fully parsed recipe', () => {
      const result = parseRecipeText(SAMPLE_RECIPE);
      expect(result.title).toBe('Classic Spaghetti Carbonara');
      expect(result.prep_time_minutes).toBe(10);
      expect(result.cook_time_minutes).toBe(20);
      expect(result.servings).toBe(4);
      expect(result.ingredients.length).toBeGreaterThan(0);
      expect(result.steps.length).toBeGreaterThan(0);
      expect(['easy', 'medium', 'hard']).toContain(result.difficulty);
    });

    it('handles empty input gracefully', () => {
      const result = parseRecipeText('');
      expect(result.title).toBeNull();
      expect(result.ingredients).toHaveLength(0);
      expect(result.steps).toHaveLength(0);
    });
  });
});
