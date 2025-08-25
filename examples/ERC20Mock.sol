// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title ERC20Mock
 * @dev A mock ERC20 token for gas profiling demonstrations
 * Contains various optimization patterns and gas consumption scenarios
 */
contract ERC20Mock {
    string public name = "MockToken";
    string public symbol = "MOCK";
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // Constructor
    constructor(uint256 _totalSupply) {
        totalSupply = _totalSupply * 10**decimals;
        _balances[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }

    // View functions (low gas)
    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowances[owner][spender];
    }

    // Standard transfer (medium gas)
    function transfer(address to, uint256 amount) public returns (bool) {
        address owner = msg.sender;
        _transfer(owner, to, amount);
        return true;
    }

    // Transfer with approval (higher gas)
    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        address spender = msg.sender;
        _spendAllowance(from, spender, amount);
        _transfer(from, to, amount);
        return true;
    }

    // Approval (medium gas)
    function approve(address spender, uint256 amount) public returns (bool) {
        address owner = msg.sender;
        _approve(owner, spender, amount);
        return true;
    }

    // Batch transfer (high gas, demonstrates loop optimization)
    function batchTransfer(address[] calldata recipients, uint256[] calldata amounts) public returns (bool) {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        require(recipients.length <= 100, "Too many recipients");

        address sender = msg.sender;
        
        // Gas optimization: cache balance once
        uint256 senderBalance = _balances[sender];
        uint256 totalAmount = 0;

        // Calculate total amount first
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }

        require(senderBalance >= totalAmount, "Insufficient balance");

        // Perform transfers
        _balances[sender] = senderBalance - totalAmount;
        
        for (uint256 i = 0; i < recipients.length; i++) {
            _balances[recipients[i]] += amounts[i];
            emit Transfer(sender, recipients[i], amounts[i]);
        }

        return true;
    }

    // Mint function (state change, medium gas)
    function mint(address to, uint256 amount) public returns (bool) {
        require(to != address(0), "Mint to zero address");
        
        totalSupply += amount;
        _balances[to] += amount;
        
        emit Transfer(address(0), to, amount);
        return true;
    }

    // Burn function (state change with refund, variable gas)
    function burn(uint256 amount) public returns (bool) {
        address account = msg.sender;
        uint256 accountBalance = _balances[account];
        require(accountBalance >= amount, "Burn amount exceeds balance");

        _balances[account] = accountBalance - amount;
        totalSupply -= amount;

        emit Transfer(account, address(0), amount);
        return true;
    }

    // Gas-intensive function for testing optimization
    function heavyComputation(uint256 iterations) public pure returns (uint256) {
        uint256 result = 0;
        for (uint256 i = 1; i <= iterations; i++) {
            result += i * i; // Quadratic computation
        }
        return result;
    }

    // Memory vs storage gas comparison
    function updateBalanceMemory(address account, uint256 newBalance) public {
        // Less gas efficient - multiple storage reads/writes
        _balances[account] = newBalance;
        if (_balances[account] > 1000 * 10**decimals) {
            _balances[account] = _balances[account] / 2;
        }
    }

    function updateBalanceOptimized(address account, uint256 newBalance) public {
        // More gas efficient - single storage write
        uint256 finalBalance = newBalance;
        if (finalBalance > 1000 * 10**decimals) {
            finalBalance = finalBalance / 2;
        }
        _balances[account] = finalBalance;
    }

    // Internal functions
    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "Transfer from zero address");
        require(to != address(0), "Transfer to zero address");

        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "Transfer amount exceeds balance");

        _balances[from] = fromBalance - amount;
        _balances[to] += amount;

        emit Transfer(from, to, amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "Approve from zero address");
        require(spender != address(0), "Approve to zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _spendAllowance(address owner, address spender, uint256 amount) internal {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "Insufficient allowance");
            _approve(owner, spender, currentAllowance - amount);
        }
    }
}