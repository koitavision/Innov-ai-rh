"""The versioned API, served to authenticated callers.

The apps gateway in front of the module authenticates every request and puts the caller's token
on it; routes that spend that credential (via ``utils.mistral.caller_mistral_client``) refuse
requests that carry none. The empty tuple is the declaration that this subtree expects a caller,
not an omission: a subtree that omits ``dependencies`` raises ``UndeclaredAccessRuleError``.
"""

from fastapi import params

dependencies: tuple[params.Depends, ...] = ()
