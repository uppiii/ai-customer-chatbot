import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkCancellationEligibility,
  checkCodEligibility,
  checkReturnEligibility,
  buildSummary,
  classifyIntent,
  contextualizeFollowUp,
  generateAgentReply,
  getProductDetails,
  isAwaitingClarification,
  getShippingQuote,
  runSupportTool
} from '../src/agent.js';

test('looks up the seeded out-for-delivery order without inventing details', () => {
  const reply = generateAgentReply('Where is my order ORD-101?');
  assert.match(reply, /out for delivery/i);
  assert.match(reply, /6 PM today/i);
});

test('builds a call summary from customer and agent turns with order state', () => {
  const summary = buildSummary([
    { role: 'agent', text: 'Hello, how can I help?' },
    { role: 'customer', text: 'Where is ORD-101?' },
    { role: 'agent', text: 'It is out for delivery by 6 PM today.' }
  ], 'ORDER_TRACKING', 'ORD-101', 'RESOLVED');

  assert.equal(summary.customer_intent, 'ORDER_TRACKING');
  assert.equal(summary.order_id, 'ORD-101');
  assert.equal(summary.resolution_status, 'RESOLVED');
  assert.match(summary.call_summary, /Customer asked: Where is ORD-101\?/);
  assert.match(summary.call_summary, /ORD-101 \(Vitamin C Serum \(30ml\)\) is Out for Delivery/);
  assert.match(summary.call_summary, /Agent responded: It is out for delivery by 6 PM today/);
});

test('asks for an order ID when order tracking is ambiguous', () => {
  const reply = generateAgentReply('Where is my order?');
  assert.match(reply, /share your order ID/i);
});

test('enforces the return window from seeded order data', () => {
  const result = checkReturnEligibility('ORD-102', { opened: false });
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'OUTSIDE_RETURN_WINDOW');
  assert.match(generateAgentReply('Can I return ORD-102?'), /14 days ago/i);
});

test('keeps return intent when the order ID arrives in the next turn', () => {
  const intent = classifyIntent('Can I return my order?');
  const firstReply = generateAgentReply('Can I return my order?');
  assert.equal(intent, 'RETURNS');
  assert.equal(isAwaitingClarification(firstReply), true);

  const followUp = contextualizeFollowUp('ORD-101', intent);
  assert.equal(followUp, 'return order ORD-101');
  assert.match(generateAgentReply(followUp), /not been delivered yet/i);

  const deliveredOrderReply = generateAgentReply(contextualizeFollowUp('ORD-102', intent));
  assert.match(deliveredOrderReply, /delivered 14 days ago/i);
});

test('keeps the request context when an unknown order ID needs correction', () => {
  const intent = classifyIntent('Can I return my order?');
  const reply = generateAgentReply(contextualizeFollowUp('ORD-999', intent));
  assert.match(reply, /could you please check the order ID/i);
  assert.equal(isAwaitingClarification(reply), true);
});

test('answers Green Tea Face Wash + Toner questions specifically without inventing product claims', () => {
  const details = getProductDetails('Tell me about Green Tea Face Wash + Toner');
  assert.equal(details.name, 'Green Tea Face Wash + Toner');
  assert.equal(details.sample_order_id, 'ORD-103');
  assert.equal(details.product_details_provided, false);

  const reply = generateAgentReply('I want to know about Green Tea Face Wash + Toner');
  assert.match(reply, /Green Tea Face Wash \+ Toner/);
  assert.match(reply, /Ingredients, skin-type suitability, benefits, and usage directions were not provided/i);
  assert.doesNotMatch(reply, /reduces acne|brightens|hydrates|removes tan/i);
  assert.equal(isAwaitingClarification(reply), true);
});

test('resolves a follow-up about this product from the previously mentioned order', () => {
  const contextualText = contextualizeFollowUp('Can you tell me about this product?', null, null, 'ORD-103');
  assert.match(contextualText, /^product details ORD-103 /);
  const reply = generateAgentReply(contextualText);
  assert.match(reply, /Green Tea Face Wash \+ Toner/);
  assert.match(reply, /no product description was provided/i);
  assert.doesNotMatch(reply, /standard delivery time|delivery date/i);
});

test('does not let a greeting hide an order request', () => {
  const reply = generateAgentReply('Hello, where is my order ORD-101?');
  assert.match(reply, /out for delivery/i);
  assert.doesNotMatch(reply, /how can I help/i);
});

test('reports an already delivered order instead of giving an estimated delivery window', () => {
  const reply = generateAgentReply('When will ORD-102 arrive?');
  assert.match(reply, /already been delivered/i);
  assert.doesNotMatch(reply, /standard delivery takes 3–5/i);
});

test('routes damage reports to the photo and 48-hour policy', () => {
  const reply = generateAgentReply('My sunscreen arrived damaged. What should I do?');
  assert.match(reply, /48 hours/i);
  assert.match(reply, /photos/i);
  assert.doesNotMatch(reply, /ingredients.*skin-type suitability/i);
});

test('does not make unsupported product suitability claims', () => {
  const reply = generateAgentReply('Can I use Green Tea Face Wash + Toner on sensitive skin?');
  assert.match(reply, /skin-type suitability.*not provided/i);
  assert.doesNotMatch(reply, /safe for sensitive skin|suitable for sensitive skin/i);
});

test('treats cancellation-status questions as order status, not a cancellation request', () => {
  const reply = generateAgentReply('Has ORD-103 been cancelled?');
  assert.match(reply, /currently processing/i);
  assert.match(reply, /cannot submit a cancellation/i);
});

test('keeps product context while asking for missing product information', () => {
  const productReply = generateAgentReply('Tell me about Green Tea Face Wash + Toner');
  assert.equal(isAwaitingClarification(productReply), true);
  const followUp = contextualizeFollowUp('What are the ingredients in this product?', null, null, 'ORD-103');
  assert.match(followUp, /^product details ORD-103 /);
  const followUpReply = generateAgentReply(followUp);
  assert.match(followUpReply, /Green Tea Face Wash \+ Toner/);
  assert.match(followUpReply, /ingredients.*not provided/i);
});

test('does not answer unrelated questions with a misleading product overview', () => {
  const reply = generateAgentReply('What is your office address?');
  assert.match(reply, /only help with Aura Skincare/i);
  assert.doesNotMatch(reply, /premium organic products/i);
});

test('does not approve returns for opened products', () => {
  const result = checkReturnEligibility('ORD-102', { opened: true, daysSinceDelivery: 3 });
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'OPENED_PRODUCT');
  assert.match(generateAgentReply('I opened this 20 days ago, can I return it?'), /outside Aura Skincare’s 7-day/i);
});

test('checks cancellation only while the order is processing', () => {
  assert.equal(checkCancellationEligibility('ORD-103').eligible, true);
  assert.equal(checkCancellationEligibility('ORD-101').eligible, false);
  assert.equal(checkCancellationEligibility('ORD-999').reason, 'ORDER_NOT_FOUND');
});

test('applies shipping and COD thresholds', () => {
  assert.equal(getShippingQuote(500).fee, 0);
  assert.equal(getShippingQuote(499).fee, 50);
  assert.equal(checkCodEligibility(2500).eligible, true);
  assert.equal(checkCodEligibility(2501).eligible, false);
  assert.match(generateAgentReply('What is the shipping fee for ORD-101?'), /delivery is free/i);
  assert.match(generateAgentReply('Can I pay by COD for ORD-103?'), /COD is available/i);
});

test('does not imply that eligibility checks submit an order cancellation', () => {
  assert.match(generateAgentReply('Can I cancel ORD-103?'), /cannot submit the cancellation request/i);
  assert.match(generateAgentReply('Can I cancel ORD-101?'), /cannot be cancelled/i);
});

test('routes tool calls through the named support tool registry', () => {
  assert.equal(runSupportTool('get_order_details', { order_id: 'ORD-103' }).status, 'Processing');
  assert.equal(runSupportTool('unknown_tool', {}).error.startsWith('Unknown support tool'), true);
});

test('supports Hinglish order lookup and declines unrelated travel requests', () => {
  assert.match(generateAgentReply('Mera order ORD-101 kahan hai?', 'hi-IN'), /aaj shaam 6 baje/i);
  assert.match(generateAgentReply('Can you book a flight to Goa?', 'hi-IN'), /sirf Aura Skincare/i);
});

test('shipping questions do not accidentally trigger the greeting response', () => {
  assert.match(generateAgentReply('What is the shipping fee?'), /₹499/i);
});
