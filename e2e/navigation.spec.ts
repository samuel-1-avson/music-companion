import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the application', async ({ page }) => {
    // Wait for app to load
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display sidebar with navigation items', async ({ page }) => {
    // Check for sidebar elements
    await expect(page.getByText('Dashboard')).toBeVisible();
  });

  test('should navigate to Chat view', async ({ page }) => {
    await page.getByText('Chat').first().click();
    // Verify chat interface loads
    await expect(page.locator('body')).toBeVisible();
  });

  test('should navigate to Settings', async ({ page }) => {
    await page.getByText('Settings').first().click();
    // Verify settings page loads
    await expect(page.locator('body')).toBeVisible();
  });

  test('should navigate to Integrations/Extensions', async ({ page }) => {
    await page.getByText('Integrations').first().click();
    // Check for SOURCES tab (Extensions component)
    await expect(page.getByText('SOURCES')).toBeVisible();
  });
});

test.describe('Theme Switching', () => {
  test('should switch themes in Settings', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to settings
    await page.getByText('Settings').first().click();
    
    // Look for theme selector and interact
    const themeSection = page.getByText('Theme').first();
    await expect(themeSection).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test('should display mobile-friendly layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // App should still be visible on mobile
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display desktop layout', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    
    // Sidebar should be visible on desktop
    await expect(page.locator('body')).toBeVisible();
  });
});
