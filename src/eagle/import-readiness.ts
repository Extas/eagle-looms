import type { IMGFetcher } from "../img-fetcher";

export const EAGLE_IMPORT_DONE_STAGE = 3;

export type ReadyForEagleImport = Pick<IMGFetcher, "stage" | "data"> & {
  data: NonNullable<IMGFetcher["data"]>;
};

export function isReadyForEagleImport(imf: Pick<IMGFetcher, "stage" | "data">): imf is ReadyForEagleImport {
  return imf.stage === EAGLE_IMPORT_DONE_STAGE && Boolean(imf.data);
}
