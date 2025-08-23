// WebSocket Connection Stability and Performance Tests
// Validates Phase 2 real-time intelligence infrastructure

import { IntelligenceWebSocketClient } from '~/lib/websocket/intelligence-websocket-client';
import type { IntelligenceUpdate, IntelligenceWebSocketHookOptions } from '~/lib/websocket/types';

interface TestResults {
  connectionTime: number;
  authenticatedTime: number;
  messageLatency: number[];
  reconnectionTime: number;
  messageDeliverySuccess: number;
  totalMessages: number;
  errors: string[];
  passed: boolean;
}

interface TestConfiguration {
  testDuration: number; // milliseconds
  messageInterval: number; // milliseconds
  reconnectTests: number;
  concurrentConnections: number;
  targetLatency: number; // max acceptable latency in ms
}

export class WebSocketConnectionTester {
  private config: TestConfiguration;
  private results: TestResults;
  private startTime: number = 0;
  private messagesSent: number = 0;
  private messagesReceived: number = 0;

  constructor(config: Partial<TestConfiguration> = {}) {
    this.config = {
      testDuration: 60000, // 1 minute
      messageInterval: 5000, // 5 seconds
      reconnectTests: 3,
      concurrentConnections: 5,
      targetLatency: 1000, // 1 second max
      ...config
    };

    this.results = {
      connectionTime: 0,
      authenticatedTime: 0,
      messageLatency: [],
      reconnectionTime: 0,
      messageDeliverySuccess: 0,
      totalMessages: 0,
      errors: [],
      passed: false
    };
  }

  /**
   * Run comprehensive WebSocket stability tests
   */
  public async runStabilityTests(): Promise<TestResults> {
    console.log('🧪 Starting WebSocket Connection Stability Tests...');
    this.startTime = Date.now();

    try {
      // Test 1: Basic connection and authentication
      await this.testBasicConnection();

      // Test 2: Message latency and delivery
      await this.testMessageLatency();

      // Test 3: Reconnection stability
      await this.testReconnectionStability();

      // Test 4: Concurrent connections
      await this.testConcurrentConnections();

      // Test 5: Long-duration stability
      await this.testLongDurationStability();

      // Evaluate results
      this.evaluateResults();

    } catch (error) {
      this.results.errors.push(`Test suite failed: ${error}`);
      this.results.passed = false;
    }

    return this.results;
  }

  /**
   * Test basic WebSocket connection and authentication
   */
  private async testBasicConnection(): Promise<void> {
    console.log('📡 Testing basic connection...');
    const startTime = Date.now();

    const options: IntelligenceWebSocketHookOptions = {
      countryId: 'test-country-001',
      subscribeToGlobal: true,
      subscribeToAlerts: true,
      onConnect: () => {
        this.results.connectionTime = Date.now() - startTime;
        console.log(`✅ Connected in ${this.results.connectionTime}ms`);
      },
      onError: (error) => {
        this.results.errors.push(`Connection error: ${error.message}`);
      }
    };

    const client = new IntelligenceWebSocketClient(options);

    try {
      await client.connect('test-user-001', 'test-country-001');
      
      // Wait for authentication
      await this.waitForAuthentication(client, 5000);
      this.results.authenticatedTime = Date.now() - startTime;

      client.disconnect();
      console.log(`✅ Basic connection test completed in ${this.results.authenticatedTime}ms`);

    } catch (error) {
      this.results.errors.push(`Basic connection failed: ${error}`);
      throw error;
    }
  }

  /**
   * Test message latency and delivery reliability
   */
  private async testMessageLatency(): Promise<void> {
    console.log('⚡ Testing message latency...');
    
    const latencyResults: number[] = [];
    const messagesReceived: IntelligenceUpdate[] = [];

    const options: IntelligenceWebSocketHookOptions = {
      countryId: 'test-country-002',
      subscribeToGlobal: true,
      subscribeToAlerts: true,
      onUpdate: (update) => {
        const latency = Date.now() - parseInt(update.data?.sentAt || '0');
        latencyResults.push(latency);
        messagesReceived.push(update);
      },
      onError: (error) => {
        this.results.errors.push(`Latency test error: ${error.message}`);
      }
    };

    const client = new IntelligenceWebSocketClient(options);

    try {
      await client.connect('test-user-002', 'test-country-002');
      await this.waitForAuthentication(client, 5000);

      // Send test messages and measure latency
      const testMessages = 10;
      for (let i = 0; i < testMessages; i++) {
        // Simulate server-side message broadcast
        await this.triggerTestBroadcast('test-country-002');
        await this.delay(this.config.messageInterval / 10); // 500ms between messages
      }

      // Wait for all messages to be received
      await this.delay(3000);

      this.results.messageLatency = latencyResults;
      this.results.totalMessages = testMessages;
      this.results.messageDeliverySuccess = messagesReceived.length;

      const avgLatency = latencyResults.reduce((sum, lat) => sum + lat, 0) / latencyResults.length || 0;
      console.log(`✅ Message latency test: ${messagesReceived.length}/${testMessages} delivered, avg latency: ${avgLatency.toFixed(2)}ms`);

      client.disconnect();

    } catch (error) {
      this.results.errors.push(`Message latency test failed: ${error}`);
      throw error;
    }
  }

  /**
   * Test reconnection stability after disconnections
   */
  private async testReconnectionStability(): Promise<void> {
    console.log('🔄 Testing reconnection stability...');
    
    const reconnectionTimes: number[] = [];
    
    const options: IntelligenceWebSocketHookOptions = {
      countryId: 'test-country-003',
      subscribeToGlobal: true,
      subscribeToAlerts: true,
      onConnect: () => {
        console.log('Reconnected successfully');
      },
      onError: (error) => {
        this.results.errors.push(`Reconnection error: ${error.message}`);
      }
    };

    const client = new IntelligenceWebSocketClient(options);

    try {
      // Initial connection
      await client.connect('test-user-003', 'test-country-003');
      await this.waitForAuthentication(client, 5000);

      // Perform reconnection tests
      for (let i = 0; i < this.config.reconnectTests; i++) {
        console.log(`Reconnection test ${i + 1}/${this.config.reconnectTests}`);
        
        // Disconnect and reconnect
        client.disconnect();
        await this.delay(1000); // Wait 1 second

        const reconnectStart = Date.now();
        await client.reconnect('test-user-003', 'test-country-003');
        await this.waitForAuthentication(client, 5000);
        
        const reconnectTime = Date.now() - reconnectStart;
        reconnectionTimes.push(reconnectTime);
        console.log(`Reconnection ${i + 1} completed in ${reconnectTime}ms`);
        
        await this.delay(2000); // Wait between tests
      }

      const avgReconnectTime = reconnectionTimes.reduce((sum, time) => sum + time, 0) / reconnectionTimes.length;
      this.results.reconnectionTime = avgReconnectTime;
      
      console.log(`✅ Reconnection stability test: avg time ${avgReconnectTime.toFixed(2)}ms`);

      client.disconnect();

    } catch (error) {
      this.results.errors.push(`Reconnection stability test failed: ${error}`);
      throw error;
    }
  }

  /**
   * Test concurrent connections performance
   */
  private async testConcurrentConnections(): Promise<void> {
    console.log('👥 Testing concurrent connections...');
    
    const clients: IntelligenceWebSocketClient[] = [];
    const connectionPromises: Promise<void>[] = [];
    
    try {
      // Create multiple concurrent connections
      for (let i = 0; i < this.config.concurrentConnections; i++) {
        const options: IntelligenceWebSocketHookOptions = {
          countryId: `test-country-${i.toString().padStart(3, '0')}`,
          subscribeToGlobal: i % 2 === 0, // Half subscribe to global
          subscribeToAlerts: true,
          onError: (error) => {
            this.results.errors.push(`Concurrent connection ${i} error: ${error.message}`);
          }
        };

        const client = new IntelligenceWebSocketClient(options);
        clients.push(client);
        
        connectionPromises.push(
          client.connect(`test-user-${i.toString().padStart(3, '0')}`, options.countryId!)
        );
      }

      // Wait for all connections
      await Promise.all(connectionPromises);
      
      // Wait for authentication
      await this.delay(3000);

      // Test message broadcast to all connections
      await this.triggerTestBroadcast(); // Global broadcast
      await this.delay(2000);

      console.log(`✅ Concurrent connections test: ${this.config.concurrentConnections} connections established`);

      // Cleanup
      clients.forEach(client => client.disconnect());

    } catch (error) {
      this.results.errors.push(`Concurrent connections test failed: ${error}`);
      // Cleanup on failure
      clients.forEach(client => client.disconnect());
      throw error;
    }
  }

  /**
   * Test long-duration connection stability
   */
  private async testLongDurationStability(): Promise<void> {
    console.log(`⏱️  Testing long-duration stability (${this.config.testDuration}ms)...`);
    
    let messagesReceived = 0;
    let lastMessageTime = Date.now();
    
    const options: IntelligenceWebSocketHookOptions = {
      countryId: 'test-country-duration',
      subscribeToGlobal: true,
      subscribeToAlerts: true,
      onUpdate: () => {
        messagesReceived++;
        lastMessageTime = Date.now();
      },
      onError: (error) => {
        this.results.errors.push(`Duration test error: ${error.message}`);
      }
    };

    const client = new IntelligenceWebSocketClient(options);

    try {
      await client.connect('test-user-duration', 'test-country-duration');
      await this.waitForAuthentication(client, 5000);

      const endTime = Date.now() + this.config.testDuration;
      
      // Send periodic test messages
      const messageInterval = setInterval(async () => {
        if (Date.now() < endTime) {
          await this.triggerTestBroadcast('test-country-duration');
        }
      }, this.config.messageInterval);

      // Wait for test duration
      await this.delay(this.config.testDuration);
      clearInterval(messageInterval);

      console.log(`✅ Long-duration test: ${messagesReceived} messages received over ${this.config.testDuration}ms`);

      client.disconnect();

    } catch (error) {
      this.results.errors.push(`Long-duration stability test failed: ${error}`);
      throw error;
    }
  }

  /**
   * Evaluate test results and determine if tests passed
   */
  private evaluateResults(): void {
    const criteria = {
      connectionTime: this.results.connectionTime < 5000, // <5 seconds
      messageLatency: this.results.messageLatency.every(lat => lat < this.config.targetLatency),
      messageDelivery: (this.results.messageDeliverySuccess / Math.max(this.results.totalMessages, 1)) >= 0.95, // 95% success
      reconnectionTime: this.results.reconnectionTime < 10000, // <10 seconds
      noErrors: this.results.errors.length === 0
    };

    this.results.passed = Object.values(criteria).every(Boolean);

    console.log('\n📊 Test Results Summary:');
    console.log(`Connection Time: ${this.results.connectionTime}ms ${criteria.connectionTime ? '✅' : '❌'}`);
    console.log(`Average Latency: ${(this.results.messageLatency.reduce((sum, lat) => sum + lat, 0) / this.results.messageLatency.length || 0).toFixed(2)}ms ${criteria.messageLatency ? '✅' : '❌'}`);
    console.log(`Message Delivery: ${this.results.messageDeliverySuccess}/${this.results.totalMessages} (${((this.results.messageDeliverySuccess / Math.max(this.results.totalMessages, 1)) * 100).toFixed(1)}%) ${criteria.messageDelivery ? '✅' : '❌'}`);
    console.log(`Reconnection Time: ${this.results.reconnectionTime.toFixed(2)}ms ${criteria.reconnectionTime ? '✅' : '❌'}`);
    console.log(`Errors: ${this.results.errors.length} ${criteria.noErrors ? '✅' : '❌'}`);
    
    if (this.results.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      this.results.errors.forEach(error => console.log(`  - ${error}`));
    }

    console.log(`\n${this.results.passed ? '🎉 All tests PASSED!' : '⚠️  Some tests FAILED'}`);
  }

  /**
   * Trigger a test broadcast via the API
   */
  private async triggerTestBroadcast(countryId?: string): Promise<void> {
    try {
      const response = await fetch('/api/websocket-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'trigger_broadcast',
          countryId,
          data: { sentAt: Date.now().toString() }
        })
      });

      if (!response.ok) {
        throw new Error(`Broadcast trigger failed: ${response.statusText}`);
      }
    } catch (error) {
      console.warn('Failed to trigger test broadcast:', error);
    }
  }

  /**
   * Wait for client authentication
   */
  private async waitForAuthentication(client: IntelligenceWebSocketClient, timeout: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const state = client.getState();
      if (state.authenticated) {
        return;
      }
      await this.delay(100);
    }
    
    throw new Error('Authentication timeout');
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Example usage and test runner
export async function runWebSocketTests(): Promise<void> {
  const tester = new WebSocketConnectionTester({
    testDuration: 30000, // 30 seconds for quick test
    messageInterval: 2000, // 2 seconds
    reconnectTests: 2,
    concurrentConnections: 3,
    targetLatency: 1000
  });

  try {
    const results = await tester.runStabilityTests();
    
    if (results.passed) {
      console.log('🚀 WebSocket infrastructure is ready for production!');
    } else {
      console.log('⚠️  WebSocket infrastructure needs attention before production deployment');
    }

    // Results logged above, function returns void
  } catch (error) {
    console.error('Test execution failed:', error);
    throw error;
  }
}