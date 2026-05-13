// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title VaultID V3
 * @notice Wallet-bound encrypted credential infrastructure.
 *         Soulbound ERC-721 with dual-token payment (CLAWD + USDC),
 *         issuer registry, viewer permissions, and recovery wallet.
 *
 * Design notes:
 * - Vault owners can revoke/unrevoke their own vault (by design: privacy vaults are
 *   self-managed). Institutional revocation should be layered off-chain.
 * - Recovery wallet is meant to be a SEPARATE wallet, not the owner. Enforced at mint
 *   and setRecoveryWallet to prevent soulbound bypass.
 * - CLAWD and USDC are assumed to be standard non-fee-on-transfer ERC20s.
 * - tokenURI returns only public metadataURI; encryptedPayloadRef is NEVER exposed here.
 */
contract VaultIDV3 is ERC721, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Types ────────────────────────────────────────────────────────────

    enum CredentialType {
        VAULT,
        MEMBERSHIP,
        CREDENTIAL,
        PASS,
        RECEIPT,
        DOCUMENT
    }

    struct Vault {
        address recoveryWallet;
        uint64 expiry;
        bool revoked;
        CredentialType credType;
        address issuer;
        string encryptedPayloadRef;
        string metadataURI;
        uint8 schemaVersion;
        // NOTE: no `owner` field — use ERC721.ownerOf(tokenId) as sole source of truth
    }

    struct MembershipInfo {
        string tier;
        string identifier; // opaque alias (hash/UUID), never PII
        uint64 expiry;
        bool active;
    }

    struct IssuerInfo {
        string name;
        bool verified;
        bool active;
    }

    struct MintParams {
        CredentialType credType;
        address issuer;
        string encryptedPayloadRef;
        string metadataURI;
        uint64 expiry;
        address recoveryWallet;
        uint8 schemaVersion;
    }

    // ─── State ────────────────────────────────────────────────────────────

    IERC20 public immutable clawdToken;
    IERC20 public immutable usdcToken;

    uint256 public clawdMintPrice;
    uint256 public usdcMintPrice;
    address public feeRecipient;

    uint256 private _nextTokenId;
    uint256 private _burnedCount;

    mapping(uint256 => Vault) private _vaults;
    mapping(uint256 => MembershipInfo) private _memberships;
    mapping(address => IssuerInfo) private _issuers;

    // tokenId => viewer => authorized
    mapping(uint256 => mapping(address => bool)) private _viewerPermissions;

    // ─── Events ───────────────────────────────────────────────────────────

    event VaultMinted(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed issuer,
        CredentialType credType,
        uint64 expiry
    );
    event VaultRevoked(uint256 indexed tokenId);
    event VaultUnrevoked(uint256 indexed tokenId);
    event VaultBurned(uint256 indexed tokenId);
    event VaultRecovered(uint256 indexed tokenId, address indexed newOwner);
    event ExpiryExtended(uint256 indexed tokenId, uint64 newExpiry);
    event RecoveryWalletSet(uint256 indexed tokenId, address indexed recoveryWallet);
    event ViewerPermissionGranted(uint256 indexed tokenId, address indexed viewer);
    event ViewerPermissionRevoked(uint256 indexed tokenId, address indexed viewer);
    event SignerInvited(uint256 indexed tokenId, address indexed signer);
    event IssuerRegistered(address indexed issuer, string name);
    event IssuerVerified(address indexed issuer);
    event IssuerDeactivated(address indexed issuer);
    event IssuerReactivated(address indexed issuer);
    event MembershipInfoSet(uint256 indexed tokenId);
    event MintPricesUpdated(uint256 clawdPrice, uint256 usdcPrice);
    event FeeRecipientUpdated(address indexed newRecipient);

    // ─── Errors ───────────────────────────────────────────────────────────

    error Soulbound();
    error IssuerNotActive();
    error IssuerNotRegistered();
    error NotTokenOwner();
    error NotRecoveryWallet();
    error VaultIsRevoked();
    error VaultNotRevoked();
    error InvalidExpiry();
    error ZeroAddress();
    error AlreadyRegistered();
    error RecoveryWalletMustDiffer();

    // ─── Constructor ──────────────────────────────────────────────────────

    constructor(
        address _clawd,
        address _usdc,
        uint256 _clawdPrice,
        uint256 _usdcPrice,
        address _feeRecipient,
        address _owner
    ) ERC721("VaultID", "VAULT") Ownable(_owner) {
        if (_clawd == address(0) || _usdc == address(0) || _feeRecipient == address(0)) {
            revert ZeroAddress();
        }
        clawdToken = IERC20(_clawd);
        usdcToken = IERC20(_usdc);
        clawdMintPrice = _clawdPrice;
        usdcMintPrice = _usdcPrice;
        feeRecipient = _feeRecipient;
    }

    // ─── Minting ──────────────────────────────────────────────────────────

    /// @notice Mint a vault credential by paying CLAWD tokens.
    function mintWithCLAWD(MintParams calldata params) external nonReentrant returns (uint256 tokenId) {
        // Checks
        _validateMintParams(params);
        // Effects
        tokenId = _mintVault(params);
        // Interactions — after all state changes (CEI)
        clawdToken.safeTransferFrom(msg.sender, feeRecipient, clawdMintPrice);
    }

    /// @notice Mint a vault credential by paying USDC tokens.
    function mintWithUSDC(MintParams calldata params) external nonReentrant returns (uint256 tokenId) {
        // Checks
        _validateMintParams(params);
        // Effects
        tokenId = _mintVault(params);
        // Interactions — after all state changes (CEI)
        usdcToken.safeTransferFrom(msg.sender, feeRecipient, usdcMintPrice);
    }

    function _validateMintParams(MintParams calldata params) internal view {
        // If expiry is set, it must be in the future
        if (params.expiry != 0 && params.expiry <= block.timestamp) revert InvalidExpiry();
        // If issuer provided, it must be registered and active
        if (params.issuer != address(0)) {
            IssuerInfo storage info = _issuers[params.issuer];
            if (bytes(info.name).length == 0) revert IssuerNotRegistered();
            if (!info.active) revert IssuerNotActive();
        }
        // Recovery wallet must be a different address than the minter
        // (prevents trivial soulbound bypass: owner calling recoverVault on themselves)
        if (params.recoveryWallet != address(0) && params.recoveryWallet == msg.sender) {
            revert RecoveryWalletMustDiffer();
        }
    }

    function _mintVault(MintParams calldata params) internal returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _vaults[tokenId] = Vault({
            recoveryWallet: params.recoveryWallet,
            expiry: params.expiry,
            revoked: false,
            credType: params.credType,
            issuer: params.issuer,
            encryptedPayloadRef: params.encryptedPayloadRef,
            metadataURI: params.metadataURI,
            schemaVersion: params.schemaVersion
        });
        emit VaultMinted(tokenId, msg.sender, params.issuer, params.credType, params.expiry);
    }

    // ─── Vault Owner Actions ──────────────────────────────────────────────

    function revokeVault(uint256 tokenId) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (_vaults[tokenId].revoked) revert VaultIsRevoked();
        _vaults[tokenId].revoked = true;
        emit VaultRevoked(tokenId);
    }

    function unrevokeVault(uint256 tokenId) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (!_vaults[tokenId].revoked) revert VaultNotRevoked();
        _vaults[tokenId].revoked = false;
        emit VaultUnrevoked(tokenId);
    }

    function extendExpiry(uint256 tokenId, uint64 newExpiry) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        uint64 current = _vaults[tokenId].expiry;
        // Cannot convert "never expires" (0) to a finite expiry
        if (current == 0) revert InvalidExpiry();
        // New expiry must be strictly greater and in the future
        if (newExpiry <= current || newExpiry <= block.timestamp) revert InvalidExpiry();
        _vaults[tokenId].expiry = newExpiry;
        emit ExpiryExtended(tokenId, newExpiry);
    }

    function setRecoveryWallet(uint256 tokenId, address recoveryWallet) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        // Recovery wallet must be a different address than the current owner
        if (recoveryWallet != address(0) && recoveryWallet == msg.sender) {
            revert RecoveryWalletMustDiffer();
        }
        _vaults[tokenId].recoveryWallet = recoveryWallet;
        emit RecoveryWalletSet(tokenId, recoveryWallet);
    }

    function burnVault(uint256 tokenId) external nonReentrant {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        delete _vaults[tokenId];
        delete _memberships[tokenId];
        ++_burnedCount;
        _burn(tokenId);
        emit VaultBurned(tokenId);
    }

    // ─── Viewer Permissions (authorization signals only, no plaintext) ─────

    function grantViewerPermission(uint256 tokenId, address viewer) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (viewer == address(0)) revert ZeroAddress();
        _viewerPermissions[tokenId][viewer] = true;
        emit ViewerPermissionGranted(tokenId, viewer);
    }

    function revokeViewerPermission(uint256 tokenId, address viewer) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        _viewerPermissions[tokenId][viewer] = false;
        emit ViewerPermissionRevoked(tokenId, viewer);
    }

    // ─── Signer Invitations (event-only, no on-chain signer array) ────────

    function inviteSigner(uint256 tokenId, address signer) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (signer == address(0)) revert ZeroAddress();
        emit SignerInvited(tokenId, signer);
    }

    // ─── Recovery ─────────────────────────────────────────────────────────

    function recoverVault(uint256 tokenId, address newOwner) external nonReentrant {
        Vault storage vault = _vaults[tokenId];
        if (msg.sender != vault.recoveryWallet) revert NotRecoveryWallet();
        if (newOwner == address(0)) revert ZeroAddress();
        address currentOwner = ownerOf(tokenId);
        // Recovery bypasses soulbound — transfer is allowed because msg.sender == recoveryWallet
        // (enforced in _update via the same check)
        _transfer(currentOwner, newOwner, tokenId);
        emit VaultRecovered(tokenId, newOwner);
    }

    // ─── Membership ───────────────────────────────────────────────────────

    function setMembershipInfo(
        uint256 tokenId,
        string calldata tier,
        string calldata identifier,
        uint64 expiry,
        bool active
    ) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        _memberships[tokenId] = MembershipInfo({ tier: tier, identifier: identifier, expiry: expiry, active: active });
        emit MembershipInfoSet(tokenId);
    }

    // ─── Issuer Registry (owner-only) ─────────────────────────────────────

    function registerIssuer(address issuer, string calldata name) external onlyOwner {
        if (issuer == address(0)) revert ZeroAddress();
        IssuerInfo storage info = _issuers[issuer];
        // Cannot register if already active or if name is set (registered but deactivated)
        if (info.active || bytes(info.name).length > 0) revert AlreadyRegistered();
        _issuers[issuer] = IssuerInfo({ name: name, verified: false, active: true });
        emit IssuerRegistered(issuer, name);
    }

    function verifyIssuer(address issuer) external onlyOwner {
        if (bytes(_issuers[issuer].name).length == 0) revert IssuerNotRegistered();
        _issuers[issuer].verified = true;
        emit IssuerVerified(issuer);
    }

    function deactivateIssuer(address issuer) external onlyOwner {
        if (bytes(_issuers[issuer].name).length == 0) revert IssuerNotRegistered();
        _issuers[issuer].active = false;
        emit IssuerDeactivated(issuer);
    }

    function reactivateIssuer(address issuer) external onlyOwner {
        if (bytes(_issuers[issuer].name).length == 0) revert IssuerNotRegistered();
        _issuers[issuer].active = true;
        emit IssuerReactivated(issuer);
    }

    // ─── Admin ────────────────────────────────────────────────────────────

    function setMintPrices(uint256 newClawdPrice, uint256 newUsdcPrice) external onlyOwner {
        clawdMintPrice = newClawdPrice;
        usdcMintPrice = newUsdcPrice;
        emit MintPricesUpdated(newClawdPrice, newUsdcPrice);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(newRecipient);
    }

    // ─── Soulbound Enforcement ────────────────────────────────────────────

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        // Allow: mint (from == address(0))
        // Allow: burn (to == address(0))
        // Allow: recovery (msg.sender is the vault's recovery wallet)
        // Block: all other transfers
        if (from != address(0) && to != address(0)) {
            Vault storage vault = _vaults[tokenId];
            if (msg.sender != vault.recoveryWallet) revert Soulbound();
        }
    }

    function approve(address, uint256) public pure override {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }

    // ─── Views ────────────────────────────────────────────────────────────

    function getVault(uint256 tokenId) external view returns (Vault memory) {
        ownerOf(tokenId); // reverts if nonexistent
        return _vaults[tokenId];
    }

    function getMembership(uint256 tokenId) external view returns (MembershipInfo memory) {
        return _memberships[tokenId];
    }

    function getIssuer(address issuer) external view returns (IssuerInfo memory) {
        return _issuers[issuer];
    }

    function isViewer(uint256 tokenId, address viewer) external view returns (bool) {
        return _viewerPermissions[tokenId][viewer];
    }

    function isValidVault(uint256 tokenId) external view returns (bool) {
        // Use internal _ownerOf to avoid external call + try/catch gas overhead
        if (_ownerOf(tokenId) == address(0)) return false;
        Vault storage v = _vaults[tokenId];
        bool notRevoked = !v.revoked;
        bool notExpired = v.expiry == 0 || block.timestamp <= v.expiry;
        return notRevoked && notExpired;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        ownerOf(tokenId); // reverts if nonexistent
        // Public metadata only — encryptedPayloadRef is NEVER returned here
        return _vaults[tokenId].metadataURI;
    }

    /// @notice Total number of vaults minted (includes burned tokens).
    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }

    /// @notice Current active supply (minted minus burned).
    function totalSupply() external view returns (uint256) {
        return _nextTokenId - _burnedCount;
    }
}
