# Deployment

**Live URL:** https://bafybeidptmqzds2avxvcxdvzdzl6vu6ekgyhcgqsijzaeevq3ldb377arq.ipfs.community.bgipfs.com/
**CID:** bafybeidptmqzds2avxvcxdvzdzl6vu6ekgyhcgqsijzaeevq3ldb377arq
**Deployed:** 2026-05-13

Static export uploaded to BGIPFS. The CID is content-addressed: every byte of
`packages/nextjs/out/` is included. To redeploy, rebuild and re-upload — a
new CID will be issued for any change.

## Next Steps

VaultIDV3 mainnet deployment is **pending client approval**. The frontend
currently references VaultIDV3 via scaffold deploy hooks (Base mainnet). Once
the contract is deployed:

1. Client calls `acceptOwnership()` after deploy script runs
2. Update `deployedContracts.ts` with the live VaultIDV3 address
3. Rebuild and re-upload to BGIPFS for a new CID
