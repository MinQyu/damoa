import { VendorPriceResult } from "../types";

export type VendorAdapter = (url: string) => Promise<VendorPriceResult>;
