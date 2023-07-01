# 2.0.0

Breaking: require nodejs 18+.
Removes node-fetch, uses native fetch.

# 1.1.0

Allow getting dependency trees of provides as well as packages.  
For example, this fixes `openssh-client` which is no longer a package but openssh-client-common and openssh-client-default.

# 1.0.0

Upgrade to node-fetch v3.
ESM only package.
