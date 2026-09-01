// Compatibility export for any out-of-tree integration importing the former
// name. New code must use GeminiBatchSttAdapter: this workflow is not Live API
// or WebSocket based.
export { GeminiBatchSttAdapter as GeminiLiveSttAdapter } from "./GeminiBatchSttAdapter";
