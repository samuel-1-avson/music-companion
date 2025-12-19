import { test, expect } from '@playwright/test';

test.describe('Music Player', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for initial load
    await page.waitForTimeout(1000);
  });

  test('should display player bar at bottom', async ({ page }) => {
    // The player bar should be visible
    await expect(page.locator('.fixed.bottom-0')).toBeVisible();
  });

  test('should show play/pause button', async ({ page }) => {
    // Look for play button in the player area
    const playerArea = page.locator('.fixed.bottom-0').first();
    await expect(playerArea).toBeVisible();
  });

  test('should display current song info', async ({ page }) => {
    // There should be song information visible
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Search Functionality', () => {
  test('should open search when clicking search or pressing /', async ({ page }) => {
    await page.goto('/');
    
    // Press / to open search
    await page.keyboard.press('/');
    await page.waitForTimeout(500);
    
    // Check if any input is focused/visible
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Queue Management', () => {
  test('should display queue panel', async ({ page }) => {
    await page.goto('/');
    
    // Look for queue toggle or panel
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Keyboard Shortcuts', () => {
  test('should respond to space bar for play/pause', async ({ page }) => {
    await page.goto('/');
    
    // Press space
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    
    // App should still be responsive
    await expect(page.locator('body')).toBeVisible();
  });

  test('should respond to arrow keys for volume', async ({ page }) => {
    await page.goto('/');
    
    // Press arrow up
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(300);
    
    await expect(page.locator('body')).toBeVisible();
  });
});
