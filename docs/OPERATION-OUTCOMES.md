# Recorded conversation outcomes

An operation result comes from the retained turn's application status, not a
model-written dialogue summary or a user's request to perform that operation.
This describes what the application recorded for that turn. It does not prove
that a file still exists, that a model used particular hardware, or that an
external side effect occurred.

`dialogueOutcome` applies the existing legacy completed/interrupted projection.
An outcome up to 512 characters is copied literally; a longer one is represented
as `{omitted: true}`, without substituting a potentially misleading prefix. The
stored original is unchanged. Archived excerpts retain this separate metadata
beside their original speaker, turn ID/index and exact quote/range. Source-file
contents and tool authority are not introduced into dialogue by that metadata.

For bounded Japanese/English information requests explicitly about earlier
conversation operations, `earlierOperationContext` searches retained requests
that have outcomes. Outcome inquiries/retries cannot serve as evidence of the
operation being asked about. At most three distinct records are selected, with
240-character focused original excerpts. This is a partial selection. It is not
a complete audit of all operations or a reconstruction of manual file actions
that did not create conversation turns.

This read-only context omits the lossy summary, unrelated recent dialogue and
file sources. It goes directly to local prose generation, without asking a model
to choose another history selector or recompact the conversation. Requests with no matching record, unrecognized requests, mixed-action requests
and current inputs retain their existing routes. Multiple matches remain a partial
selection; the model must ask which operation if the request cannot distinguish one. The fixed generation contract distinguishes cancelled, pending,
failed and unknown outcomes from success; model semantic correctness remains a
separate acceptance requirement.

The submission records a `dialogue.read` receipt with scope `recorded-outcomes`
and source `submitted-dialogue-snapshot` before model acquisition, so Activity can
show exactly what was read even if inference is not prepared. Receipts are audit
data, never permission to replay a request. Original-message copying/rewriting
keeps its existing native-message boundary. No note mutation, new write/network
capability, canonical migration or summary replacement is involved.
