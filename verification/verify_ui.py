from playwright.sync_api import sync_playwright, expect
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Load local HTML
    file_path = f"file://{os.getcwd()}/verification/index.html"
    print(f"Loading {file_path}")
    page.goto(file_path)

    # Check for Toggle Button
    btn = page.locator('#ras-toggle-btn')
    expect(btn).to_be_visible()
    print("Toggle button found")

    # Click to open panel
    btn.click()

    # Check for Main Panel (ID is ras-container)
    panel = page.locator('#ras-container')
    expect(panel).to_be_visible()
    print("Main panel opened")

    # Check for Tabs
    expect(page.locator('.ras-tab-btn', has_text="Settings")).to_be_visible()

    # Screenshot
    screenshot_path = f"{os.getcwd()}/verification/verification.png"
    page.screenshot(path=screenshot_path)
    print(f"Screenshot saved to {screenshot_path}")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
