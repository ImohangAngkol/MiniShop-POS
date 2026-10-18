import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { api, errorMessage } from "./api";
describe("LAN connection feedback", () => {
  it("uses the page origin for every API call", () =>
    expect(api.defaults.baseURL).toBe("/api"));
  it.each(["ERR_NETWORK", "ECONNABORTED"])(
    "explains unreachable local server and safe retry for %s",
    (code) => {
      const message = errorMessage(new AxiosError("Network unavailable", code));
      expect(message).toContain("shop Wi-Fi");
      expect(message).toContain("server computer");
      expect(message).toContain("same saved request");
    },
  );
});
