# IME submission boundary

Actual PC browser dispatch of Enter/keyCode229/isComposingfalse opened New file for a literal capture without explicit Send. Native textarea forwards app handler unchanged. Shared baseline has the same isComposing-only condition. MDN keydown guidance documents composition-boundary ordering where isComposingfalse still has229: https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event#keydown_events_with_ime

Use one shared pure submit-key guard in baseline and accepted product: Enter, noShift, notcomposing, not229. Preserve ordinaryEnter and explicitSend; no delay timer or model/storage change. Node cases beforefix, bothbuildchecks, actualnative syntheticcomposition/boundary events must leave draft and turncount unchanged; ordinaryEnter opens review and exactbody saves. Distinguish synthetic event controls from physicalOS/phoneIME acceptance. No lockedruntime changes.
