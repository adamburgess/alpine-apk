# 2.0.1

Fix package provides overriding packages. This happens when alpine has multiple packages that provide the same binary.
For example, nodejs-current and nodejs.

# 2.0.0

Breaking: require nodejs 18+.
Removes node-fetch, uses native fetch.

# 1.1.0

Allow getting dependency trees of provides as well as packages.  
For example, this fixes `openssh-client` which is no longer a package but openssh-client-common and openssh-client-default.

# 1.0.0

Upgrade to node-fetch v3.
ESM only package.
