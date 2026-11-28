import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { isIosSafari, useInstallStore } from "@/features/pwa/installPrompt";
import { InstallButton } from "@/features/pwa/InstallButton";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";
const IPAD_DESKTOP_MODE =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

describe("isIosSafari", () => {
  it("only matches Safari on iPhone/iPad", () => {
    expect(isIosSafari(IPHONE_SAFARI)).toBe(true);
    expect(isIosSafari(IPAD_DESKTOP_MODE, 5)).toBe(true);
    expect(isIosSafari(IPAD_DESKTOP_MODE, 0)).toBe(false); // a real Mac
    expect(isIosSafari(IPHONE_CHROME)).toBe(false);
    expect(isIosSafari(ANDROID_CHROME)).toBe(false);
  });
});

describe("InstallButton", () => {
  beforeEach(() => useInstallStore.setState({ mode: null, promptEvent: null }));

  it("renders nothing when the browser cannot install", () => {
    const { container } = render(<InstallButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the browser's install dialog and hides itself afterwards", async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event("beforeinstallprompt"), {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });
    useInstallStore.setState({ mode: "prompt", promptEvent: event });
    render(<InstallButton />);
    fireEvent.click(
      screen.getByRole("button", { name: "Install ConvertIt as an app" }),
    );
    await vi.waitFor(() => expect(prompt).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(screen.queryByRole("button")).toBeNull());
  });

  it("explains Add to Home Screen on iOS Safari", () => {
    useInstallStore.setState({ mode: "ios" });
    render(<InstallButton />);
    fireEvent.click(
      screen.getByRole("button", { name: "Install ConvertIt as an app" }),
    );
    expect(screen.getByText("Add to Home Screen")).toBeInTheDocument();
  });
});
