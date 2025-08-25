// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title HeavyLoop
 * @dev Contract for demonstrating gas optimization with loops and storage operations
 * Useful for benchmarking different optimization strategies
 */
contract HeavyLoop {
    
    // Storage variables for testing
    mapping(uint256 => uint256) public data;
    mapping(address => uint256) public userScores;
    uint256[] public array;
    uint256 public counter;
    
    // Events
    event DataProcessed(uint256 indexed id, uint256 value);
    event BatchProcessed(uint256 count, uint256 totalGas);
    
    constructor() {
        counter = 0;
    }

    // Unoptimized loop - high gas consumption
    function unoptimizedLoop(uint256 iterations) public {
        for (uint256 i = 0; i < iterations; i++) {
            data[i] = i * 2; // Multiple storage writes
            counter++; // Storage increment in loop
            
            if (i % 2 == 0) {
                userScores[msg.sender]++; // Conditional storage write
            }
        }
    }

    // Optimized loop - reduced gas consumption
    function optimizedLoop(uint256 iterations) public {
        uint256 tempCounter = counter; // Cache storage variable
        uint256 tempScore = userScores[msg.sender]; // Cache storage variable
        
        for (uint256 i = 0; i < iterations; i++) {
            data[i] = i * 2; // Still need storage writes for mapping
            tempCounter++;
            
            if (i % 2 == 0) {
                tempScore++;
            }
        }
        
        // Single storage writes at the end
        counter = tempCounter;
        userScores[msg.sender] = tempScore;
    }

    // Memory-intensive operations
    function memoryIntensiveOperation(uint256 size) public pure returns (uint256[] memory) {
        uint256[] memory result = new uint256[](size);
        
        for (uint256 i = 0; i < size; i++) {
            result[i] = i * i + 1;
        }
        
        return result;
    }

    // Storage vs Memory comparison
    function storageHeavyOperation(uint256 count) public {
        for (uint256 i = 0; i < count; i++) {
            array.push(i);
        }
    }

    function memoryHeavyOperation(uint256 count) public view returns (uint256[] memory) {
        uint256[] memory tempArray = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            tempArray[i] = i;
        }
        return tempArray;
    }

    // Nested loops for gas explosion testing
    function nestedLoops(uint256 outer, uint256 inner) public pure returns (uint256) {
        uint256 result = 0;
        
        for (uint256 i = 0; i < outer; i++) {
            for (uint256 j = 0; j < inner; j++) {
                result += i * j;
            }
        }
        
        return result;
    }

    // Batch processing with events
    function batchProcess(uint256[] calldata values) public {
        uint256 startGas = gasleft();
        
        for (uint256 i = 0; i < values.length; i++) {
            data[i] = values[i];
            emit DataProcessed(i, values[i]);
        }
        
        uint256 gasUsed = startGas - gasleft();
        emit BatchProcessed(values.length, gasUsed);
    }

    // String concatenation - gas intensive
    function stringConcatenation(uint256 count) public pure returns (string memory) {
        string memory result = "Start";
        
        for (uint256 i = 0; i < count; i++) {
            result = string(abi.encodePacked(result, "-", uint2str(i)));
        }
        
        return result;
    }

    // Optimized string building
    function optimizedStringBuilding(uint256 count) public pure returns (string memory) {
        bytes memory result = "Start";
        
        for (uint256 i = 0; i < count; i++) {
            result = abi.encodePacked(result, "-", uint2str(i));
        }
        
        return string(result);
    }

    // Hash computation loops
    function hashComputation(uint256 iterations, bytes32 seed) public pure returns (bytes32) {
        bytes32 result = seed;
        
        for (uint256 i = 0; i < iterations; i++) {
            result = keccak256(abi.encodePacked(result, i));
        }
        
        return result;
    }

    // Array operations comparison
    function inefficientArrayOperation() public {
        // Inefficient: Growing array in loop
        delete array;
        for (uint256 i = 0; i < 50; i++) {
            array.push(i * 2);
        }
    }

    function efficientArrayOperation() public {
        // More efficient: Pre-size array
        delete array;
        
        // Set length once
        uint256 newLength = 50;
        array = new uint256[](newLength);
        
        for (uint256 i = 0; i < newLength; i++) {
            array[i] = i * 2;
        }
    }

    // Complex state transitions
    function complexStateTransition(uint256 factor) public {
        uint256 oldCounter = counter;
        
        // Multiple storage reads and writes
        for (uint256 i = 0; i < 10; i++) {
            data[i] = data[i] * factor;
            counter += data[i];
        }
        
        userScores[msg.sender] = counter - oldCounter;
    }

    // View functions for gas comparison
    function viewComplexCalculation(uint256 input) public view returns (uint256) {
        uint256 result = input;
        
        for (uint256 i = 1; i <= 100; i++) {
            result = (result * i) % 1000007; // Prime modulo for complexity
        }
        
        return result;
    }

    // Utility functions
    function uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        
        uint256 j = _i;
        uint256 len;
        
        while (j != 0) {
            len++;
            j /= 10;
        }
        
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        
        return string(bstr);
    }

    // Cleanup functions
    function clearData(uint256 count) public {
        for (uint256 i = 0; i < count; i++) {
            delete data[i];
        }
    }

    function resetArray() public {
        delete array;
    }

    function resetCounter() public {
        counter = 0;
    }

    // Getter functions
    function getArrayLength() public view returns (uint256) {
        return array.length;
    }

    function getArrayElement(uint256 index) public view returns (uint256) {
        require(index < array.length, "Index out of bounds");
        return array[index];
    }

    function getData(uint256 key) public view returns (uint256) {
        return data[key];
    }
}