// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SimpleStorage
 * @dev A simple storage contract for demonstrating Somnia Gas Profiler
 */
contract SimpleStorage {
    uint256 private value;
    mapping(address => uint256) private userValues;
    
    event ValueChanged(uint256 newValue);
    event UserValueSet(address indexed user, uint256 value);
    
    /**
     * @dev Set a new value (write operation)
     * @param newValue The value to store
     */
    function set(uint256 newValue) external {
        value = newValue;
        emit ValueChanged(newValue);
    }
    
    /**
     * @dev Get the current value (read operation)
     * @return The stored value
     */
    function get() external view returns (uint256) {
        return value;
    }
    
    /**
     * @dev Set a value for a specific user
     * @param userValue The value to store for the user
     */
    function setUserValue(uint256 userValue) external {
        userValues[msg.sender] = userValue;
        emit UserValueSet(msg.sender, userValue);
    }
    
    /**
     * @dev Get a user's stored value
     * @param user The user address
     * @return The user's stored value
     */
    function getUserValue(address user) external view returns (uint256) {
        return userValues[user];
    }
    
    /**
     * @dev Increment the stored value (combines read + write)
     */
    function increment() external {
        value++;
        emit ValueChanged(value);
    }
    
    /**
     * @dev Add to the stored value
     * @param amount The amount to add
     */
    function add(uint256 amount) external {
        value += amount;
        emit ValueChanged(value);
    }
}