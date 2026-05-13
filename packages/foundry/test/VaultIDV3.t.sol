// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/VaultIDV3.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Minimal ERC20 mock
contract MockERC20 is ERC20 {
    uint8 private _dec;

    constructor(string memory name, string memory symbol, uint8 dec) ERC20(name, symbol) {
        _dec = dec;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract VaultIDV3Test is Test {
    VaultIDV3 vault;
    MockERC20 clawd;
    MockERC20 usdc;

    address owner = address(0x1);
    address client = address(0x2);
    address issuer = address(0x3);
    address viewer = address(0x4);
    address recovery = address(0x5);
    address other = address(0x6);
    address feeCollector = address(0x7); // separate from minter to verify payment flows

    uint256 constant CLAWD_PRICE = 25_000 * 1e18;
    uint256 constant USDC_PRICE = 2_500_000;

    VaultIDV3.MintParams defaultParams;

    function setUp() public {
        clawd = new MockERC20("CLAWD", "CLAWD", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);

        vault = new VaultIDV3(
            address(clawd),
            address(usdc),
            CLAWD_PRICE,
            USDC_PRICE,
            feeCollector, // feeRecipient (distinct from minter)
            owner // initial owner
        );

        // Register issuer
        vm.prank(owner);
        vault.registerIssuer(issuer, "Test Issuer");

        defaultParams = VaultIDV3.MintParams({
            credType: VaultIDV3.CredentialType.VAULT,
            issuer: address(0), // no issuer for most tests
            encryptedPayloadRef: "ipfs://encrypted-ref",
            metadataURI: "ipfs://public-metadata",
            expiry: 0, // no expiry
            recoveryWallet: recovery,
            schemaVersion: 1
        });

        // Give client tokens for minting
        clawd.mint(client, CLAWD_PRICE * 10);
        usdc.mint(client, USDC_PRICE * 10);
    }

    // ─── Payment Rail Tests ────────────────────────────────────────────────

    function test_MintWithCLAWD() public {
        vm.startPrank(client);
        clawd.approve(address(vault), CLAWD_PRICE);
        uint256 tokenId = vault.mintWithCLAWD(defaultParams);
        vm.stopPrank();

        assertEq(vault.ownerOf(tokenId), client);
        assertEq(clawd.balanceOf(client), CLAWD_PRICE * 10 - CLAWD_PRICE);
        assertEq(clawd.balanceOf(feeCollector), CLAWD_PRICE);
    }

    function test_MintWithUSDC() public {
        vm.startPrank(client);
        usdc.approve(address(vault), USDC_PRICE);
        uint256 tokenId = vault.mintWithUSDC(defaultParams);
        vm.stopPrank();

        assertEq(vault.ownerOf(tokenId), client);
        assertEq(usdc.balanceOf(client), USDC_PRICE * 10 - USDC_PRICE);
        assertEq(usdc.balanceOf(feeCollector), USDC_PRICE);
    }

    function test_MintSendsPaymentToFeeRecipient() public {
        uint256 before = clawd.balanceOf(client);
        uint256 feeCollectorBefore = clawd.balanceOf(feeCollector);
        vm.startPrank(client);
        clawd.approve(address(vault), CLAWD_PRICE);
        vault.mintWithCLAWD(defaultParams);
        vm.stopPrank();

        assertEq(clawd.balanceOf(client), before - CLAWD_PRICE);
        assertEq(clawd.balanceOf(feeCollector), feeCollectorBefore + CLAWD_PRICE);
    }

    function test_MintRevertsWithoutAllowance() public {
        vm.prank(client);
        vm.expectRevert();
        vault.mintWithCLAWD(defaultParams);
    }

    // ─── Soulbound Enforcement ─────────────────────────────────────────────

    function test_TransferReverts() public {
        vm.startPrank(client);
        clawd.approve(address(vault), CLAWD_PRICE);
        uint256 tokenId = vault.mintWithCLAWD(defaultParams);
        vm.expectRevert(VaultIDV3.Soulbound.selector);
        vault.transferFrom(client, other, tokenId);
        vm.stopPrank();
    }

    function test_SafeTransferReverts() public {
        vm.startPrank(client);
        clawd.approve(address(vault), CLAWD_PRICE);
        uint256 tokenId = vault.mintWithCLAWD(defaultParams);
        vm.expectRevert(VaultIDV3.Soulbound.selector);
        vault.safeTransferFrom(client, other, tokenId);
        vm.stopPrank();
    }

    function test_ApproveReverts() public {
        vm.startPrank(client);
        clawd.approve(address(vault), CLAWD_PRICE);
        uint256 tokenId = vault.mintWithCLAWD(defaultParams);
        vm.expectRevert(VaultIDV3.Soulbound.selector);
        vault.approve(other, tokenId);
        vm.stopPrank();
    }

    function test_SetApprovalForAllReverts() public {
        vm.prank(client);
        vm.expectRevert(VaultIDV3.Soulbound.selector);
        vault.setApprovalForAll(other, true);
    }

    // ─── Recovery Model ────────────────────────────────────────────────────

    function test_RecoveryWalletCanRecover() public {
        vm.startPrank(client);
        clawd.approve(address(vault), CLAWD_PRICE);
        uint256 tokenId = vault.mintWithCLAWD(defaultParams);
        vm.stopPrank();

        vm.prank(recovery);
        vault.recoverVault(tokenId, other);

        assertEq(vault.ownerOf(tokenId), other);
    }

    function test_NonRecoveryCannotRecover() public {
        vm.startPrank(client);
        clawd.approve(address(vault), CLAWD_PRICE);
        uint256 tokenId = vault.mintWithCLAWD(defaultParams);
        vm.stopPrank();

        vm.prank(other);
        vm.expectRevert(VaultIDV3.NotRecoveryWallet.selector);
        vault.recoverVault(tokenId, other);
    }

    function test_RecoveryCannotRevokeOrExtend() public {
        vm.startPrank(client);
        clawd.approve(address(vault), CLAWD_PRICE);
        uint256 tokenId = vault.mintWithCLAWD(defaultParams);
        vm.stopPrank();

        // Recovery wallet cannot revoke
        vm.prank(recovery);
        vm.expectRevert(VaultIDV3.NotTokenOwner.selector);
        vault.revokeVault(tokenId);

        // Recovery wallet cannot extend expiry
        vm.prank(recovery);
        vm.expectRevert(VaultIDV3.NotTokenOwner.selector);
        vault.extendExpiry(tokenId, uint64(block.timestamp + 1000));
    }

    // ─── Revocation Model ─────────────────────────────────────────────────

    function _mintOne() internal returns (uint256) {
        vm.startPrank(client);
        clawd.approve(address(vault), CLAWD_PRICE);
        uint256 tokenId = vault.mintWithCLAWD(defaultParams);
        vm.stopPrank();
        return tokenId;
    }

    function test_RevokeAndUnrevoke() public {
        uint256 tokenId = _mintOne();

        vm.prank(client);
        vault.revokeVault(tokenId);
        assertEq(vault.getVault(tokenId).revoked, true);
        assertEq(vault.isValidVault(tokenId), false);

        vm.prank(client);
        vault.unrevokeVault(tokenId);
        assertEq(vault.getVault(tokenId).revoked, false);
        assertEq(vault.isValidVault(tokenId), true);
    }

    function test_DoubleRevokeReverts() public {
        uint256 tokenId = _mintOne();
        vm.startPrank(client);
        vault.revokeVault(tokenId);
        vm.expectRevert(VaultIDV3.VaultIsRevoked.selector);
        vault.revokeVault(tokenId);
        vm.stopPrank();
    }

    function test_UnrevokeNonRevokedReverts() public {
        uint256 tokenId = _mintOne();
        vm.prank(client);
        vm.expectRevert(VaultIDV3.VaultNotRevoked.selector);
        vault.unrevokeVault(tokenId);
    }

    // ─── Expiry Logic ──────────────────────────────────────────────────────

    function test_ExpiredVaultIsInvalid() public {
        VaultIDV3.MintParams memory params = defaultParams;
        params.expiry = uint64(block.timestamp + 100);

        vm.startPrank(client);
        clawd.approve(address(vault), CLAWD_PRICE);
        uint256 tokenId = vault.mintWithCLAWD(params);
        vm.stopPrank();

        assertEq(vault.isValidVault(tokenId), true);

        vm.warp(block.timestamp + 101);
        assertEq(vault.isValidVault(tokenId), false);
    }

    function test_ExtendExpiry() public {
        VaultIDV3.MintParams memory params = defaultParams;
        params.expiry = uint64(block.timestamp + 100);

        vm.startPrank(client);
        clawd.approve(address(vault), CLAWD_PRICE);
        uint256 tokenId = vault.mintWithCLAWD(params);
        vm.stopPrank();

        uint64 newExpiry = uint64(block.timestamp + 500);
        vm.prank(client);
        vault.extendExpiry(tokenId, newExpiry);
        assertEq(vault.getVault(tokenId).expiry, newExpiry);
    }

    function test_ExtendExpiryMustBeGreater() public {
        VaultIDV3.MintParams memory params = defaultParams;
        params.expiry = uint64(block.timestamp + 100);

        vm.startPrank(client);
        clawd.approve(address(vault), CLAWD_PRICE);
        uint256 tokenId = vault.mintWithCLAWD(params);
        vm.stopPrank();

        vm.prank(client);
        vm.expectRevert(VaultIDV3.InvalidExpiry.selector);
        vault.extendExpiry(tokenId, params.expiry);
    }

    // ─── Viewer Permissions ────────────────────────────────────────────────

    function test_GrantAndRevokeViewerPermission() public {
        uint256 tokenId = _mintOne();

        assertEq(vault.isViewer(tokenId, viewer), false);

        vm.prank(client);
        vault.grantViewerPermission(tokenId, viewer);
        assertEq(vault.isViewer(tokenId, viewer), true);

        vm.prank(client);
        vault.revokeViewerPermission(tokenId, viewer);
        assertEq(vault.isViewer(tokenId, viewer), false);
    }

    function test_NonOwnerCannotGrantViewerPermission() public {
        uint256 tokenId = _mintOne();
        vm.prank(other);
        vm.expectRevert(VaultIDV3.NotTokenOwner.selector);
        vault.grantViewerPermission(tokenId, viewer);
    }

    // ─── Signer Invitations ────────────────────────────────────────────────

    function test_InviteSignerEmitsEvent() public {
        uint256 tokenId = _mintOne();
        vm.prank(client);
        vm.expectEmit(true, true, false, false);
        emit VaultIDV3.SignerInvited(tokenId, viewer);
        vault.inviteSigner(tokenId, viewer);
    }

    function test_NonOwnerCannotInviteSigner() public {
        uint256 tokenId = _mintOne();
        vm.prank(other);
        vm.expectRevert(VaultIDV3.NotTokenOwner.selector);
        vault.inviteSigner(tokenId, viewer);
    }

    // ─── Issuer Validation ─────────────────────────────────────────────────

    function test_MintWithValidIssuer() public {
        VaultIDV3.MintParams memory params = defaultParams;
        params.issuer = issuer;

        vm.startPrank(client);
        clawd.approve(address(vault), CLAWD_PRICE);
        uint256 tokenId = vault.mintWithCLAWD(params);
        vm.stopPrank();

        assertEq(vault.getVault(tokenId).issuer, issuer);
    }

    function test_MintWithInactiveIssuerReverts() public {
        vm.prank(owner);
        vault.deactivateIssuer(issuer);

        VaultIDV3.MintParams memory params = defaultParams;
        params.issuer = issuer;

        vm.startPrank(client);
        clawd.approve(address(vault), CLAWD_PRICE);
        vm.expectRevert(VaultIDV3.IssuerNotActive.selector);
        vault.mintWithCLAWD(params);
        vm.stopPrank();
    }

    function test_MintWithUnregisteredIssuerReverts() public {
        VaultIDV3.MintParams memory params = defaultParams;
        params.issuer = address(0xBEEF);

        vm.startPrank(client);
        clawd.approve(address(vault), CLAWD_PRICE);
        vm.expectRevert(VaultIDV3.IssuerNotRegistered.selector);
        vault.mintWithCLAWD(params);
        vm.stopPrank();
    }

    function test_VerifyIssuer() public {
        vm.prank(owner);
        vault.verifyIssuer(issuer);
        assertEq(vault.getIssuer(issuer).verified, true);
    }

    function test_DeactivateIssuer() public {
        vm.prank(owner);
        vault.deactivateIssuer(issuer);
        assertEq(vault.getIssuer(issuer).active, false);
    }

    function test_RegisterDuplicateIssuerReverts() public {
        vm.prank(owner);
        vm.expectRevert(VaultIDV3.AlreadyRegistered.selector);
        vault.registerIssuer(issuer, "Duplicate");
    }

    function test_NonOwnerCannotRegisterIssuer() public {
        vm.prank(client);
        vm.expectRevert();
        vault.registerIssuer(address(0xBEEF), "Unauthorized");
    }

    // ─── Membership Logic ──────────────────────────────────────────────────

    function test_SetMembershipInfo() public {
        uint256 tokenId = _mintOne();
        uint64 exp = uint64(block.timestamp + 365 days);

        vm.prank(client);
        vault.setMembershipInfo(tokenId, "Gold", "uuid-1234", exp, true);

        VaultIDV3.MembershipInfo memory m = vault.getMembership(tokenId);
        assertEq(m.tier, "Gold");
        assertEq(m.identifier, "uuid-1234");
        assertEq(m.expiry, exp);
        assertEq(m.active, true);
    }

    // ─── Burn Flow ─────────────────────────────────────────────────────────

    function test_BurnDestroys() public {
        uint256 tokenId = _mintOne();

        vm.prank(client);
        vault.burnVault(tokenId);

        vm.expectRevert();
        vault.ownerOf(tokenId);
    }

    function test_NonOwnerCannotBurn() public {
        uint256 tokenId = _mintOne();
        vm.prank(other);
        vm.expectRevert(VaultIDV3.NotTokenOwner.selector);
        vault.burnVault(tokenId);
    }

    // ─── Pricing Updates ───────────────────────────────────────────────────

    function test_SetMintPrices() public {
        vm.prank(owner);
        vault.setMintPrices(1e18, 1e6);
        assertEq(vault.clawdMintPrice(), 1e18);
        assertEq(vault.usdcMintPrice(), 1e6);
    }

    function test_NonOwnerCannotSetPrices() public {
        vm.prank(client);
        vm.expectRevert();
        vault.setMintPrices(1e18, 1e6);
    }

    // ─── Fee Recipient Updates ─────────────────────────────────────────────

    function test_SetFeeRecipient() public {
        vm.prank(owner);
        vault.setFeeRecipient(other);
        assertEq(vault.feeRecipient(), other);
    }

    function test_SetFeeRecipientZeroReverts() public {
        vm.prank(owner);
        vm.expectRevert(VaultIDV3.ZeroAddress.selector);
        vault.setFeeRecipient(address(0));
    }

    function test_NonOwnerCannotSetFeeRecipient() public {
        vm.prank(client);
        vm.expectRevert();
        vault.setFeeRecipient(other);
    }

    // ─── Recovery Wallet Set ───────────────────────────────────────────────

    function test_SetRecoveryWallet() public {
        uint256 tokenId = _mintOne();
        vm.prank(client);
        vault.setRecoveryWallet(tokenId, other);
        assertEq(vault.getVault(tokenId).recoveryWallet, other);
    }

    // ─── tokenURI Safety ──────────────────────────────────────────────────

    function test_TokenURIReturnsMetadataURI() public {
        uint256 tokenId = _mintOne();
        assertEq(vault.tokenURI(tokenId), "ipfs://public-metadata");
    }

    function test_TokenURIDoesNotExposeEncryptedRef() public {
        uint256 tokenId = _mintOne();
        string memory uri = vault.tokenURI(tokenId);
        // URI must not contain the encrypted payload ref
        assertFalse(
            keccak256(bytes(uri)) == keccak256(bytes(vault.getVault(tokenId).encryptedPayloadRef)),
            "tokenURI must not return encryptedPayloadRef"
        );
    }
}
