import { describe, it, expect } from "vitest";
import { bboxFromCenter, haversineDistance } from "./geo.js";

describe("bboxFromCenter", () => {
  it("produces bounds that contain the center point", () => {
    const center = { lat: 42.06, lng: -73.91 };
    const bounds = bboxFromCenter(center, 16.09); // 10 miles in km
    expect(bounds.swlat).toBeLessThan(center.lat);
    expect(bounds.nelat).toBeGreaterThan(center.lat);
    expect(bounds.swlng).toBeLessThan(center.lng);
    expect(bounds.nelng).toBeGreaterThan(center.lng);
  });

  it("produces a larger box for a larger radius", () => {
    const center = { lat: 42.06, lng: -73.91 };
    const small = bboxFromCenter(center, 16.09);  // ~10 miles
    const large = bboxFromCenter(center, 80.47);  // ~50 miles
    expect(large.nelat - large.swlat).toBeGreaterThan(small.nelat - small.swlat);
    expect(large.nelng - large.swlng).toBeGreaterThan(small.nelng - small.swlng);
  });

  it("a 50-mile box from Dutchess County center covers lat 41.5 (where TRI facilities are)", () => {
    // Regression: bbox was hardcoded to 10 miles, filtering out all Dutchess County TRI facilities
    const center = { lat: 42.06, lng: -73.91 };
    const bounds = bboxFromCenter(center, 50 * 1.60934);
    expect(bounds.swlat).toBeLessThan(41.5);
    expect(bounds.nelat).toBeGreaterThan(41.5);
  });

  it("a 10-mile box does NOT cover lat 41.5", () => {
    const center = { lat: 42.06, lng: -73.91 };
    const bounds = bboxFromCenter(center, 10 * 1.60934);
    expect(bounds.swlat).toBeGreaterThan(41.5);
  });
});

describe("haversineDistance", () => {
  it("returns 0 for identical points", () => {
    const point = { lat: 42.06, lng: -73.91 };
    expect(haversineDistance(point, point)).toBe(0);
  });

  it("approximates distance between two known points", () => {
    // NYC to Boston is ~306 km
    const nyc = { lat: 40.7128, lng: -74.006 };
    const boston = { lat: 42.3601, lng: -71.0589 };
    const dist = haversineDistance(nyc, boston);
    expect(dist).toBeGreaterThan(290);
    expect(dist).toBeLessThan(320);
  });
});
