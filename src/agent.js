export const brandInfo = {
  brand: 'Aura Skincare',
  overview: 'Premium organic Indian skincare brand focused on simple, effective skincare made with thoughtfully selected ingredients.',
  shippingPolicy: 'Free delivery on orders above ₹499. Orders below ₹499 have a ₹50 shipping fee. Standard delivery takes 3–5 business days.',
  returnPolicy: 'Returns are accepted within 7 days of delivery for unopened, unused products in original packaging. Damaged or defective products must be reported within 48 hours of delivery with photos for replacement.',
  cancellationPolicy: 'Orders can be cancelled only while their status is Processing. Once an order is Shipped or Out for Delivery, it cannot be cancelled (customers may refuse delivery at doorstep).',
  codPolicy: 'COD is available for orders up to ₹2,500. Customers can pay by cash or UPI at the doorstep.'
};

export function getSuggestedQuestions() {
  return [
    'Where is my order ORD-101?',
    'Can I return my order?',
    'What is the shipping fee?',
    'Can I cancel ORD-103?',
    'Is COD available for my order?'
  ];
}

export function getPolicyHighlights() {
  return [
    'Free delivery above ₹499',
    'Returns within 7 days for unopened items',
    'COD up to ₹2500',
    'Cancellation only before shipment'
  ];
}

export const mockOrders = {
  'ORD-101': {
    order_id: 'ORD-101',
    customer: 'Priya Sharma',
    product: 'Vitamin C Serum (30ml)',
    value: 699,
    status: 'Out for Delivery',
    notes: 'BlueDart — BD-982103. Expected by 6 PM today.'
  },
  'ORD-102': {
    order_id: 'ORD-102',
    customer: 'Rahul Verma',
    product: 'Hydrating Sunscreen SPF 50',
    value: 499,
    status: 'Delivered',
    notes: 'Delhivery — DL-441029. Delivered 14 days ago.'
  },
  'ORD-103': {
    order_id: 'ORD-103',
    customer: 'Ananya Patel',
    product: 'Green Tea Face Wash + Toner',
    value: 850,
    status: 'Processing',
    notes: 'Ordered 3 hours ago. Eligible for cancellation.'
  }
};

export function getOrderDetails(orderId) {
  const normalized = String(orderId || '').trim().toUpperCase();
  return mockOrders[normalized] || null;
}

const productAliases = [
  { orderId: 'ORD-101', aliases: ['vitamin c serum', 'serum'] },
  { orderId: 'ORD-102', aliases: ['hydrating sunscreen', 'sunscreen'] },
  { orderId: 'ORD-103', aliases: ['green tea face wash + toner', 'green tea face wash toner', 'green tea', 'face wash', 'toner'] }
];

export function getProductDetails(query) {
  const text = String(query || '').toLowerCase();
  const requestedOrderId = detectOrderId(text);
  const match = requestedOrderId
    ? productAliases.find((product) => product.orderId === requestedOrderId)
    : productAliases.find((product) => product.aliases.some((alias) => text.includes(alias)));
  if (!match) return null;

  const order = getOrderDetails(match.orderId);
  return {
    name: order.product,
    sample_order_id: order.order_id,
    product_details_provided: false,
    unavailable_details: ['ingredients', 'skin-type suitability', 'benefits', 'directions']
  };
}

export function checkCancellationEligibility(orderId) {
  const order = getOrderDetails(orderId);
  if (!order) {
    return { eligible: false, reason: 'ORDER_NOT_FOUND', order: null };
  }
  return {
    eligible: order.status === 'Processing',
    reason: order.status === 'Processing' ? 'PROCESSING' : 'ORDER_ALREADY_SHIPPED_OR_DELIVERED',
    order
  };
}

export function checkReturnEligibility(orderId, { opened = null, daysSinceDelivery = null } = {}) {
  const order = getOrderDetails(orderId);
  if (!order) {
    return { eligible: false, reason: 'ORDER_NOT_FOUND', order: null };
  }

  const noteDays = order.notes.match(/delivered (\d+) days? ago/i);
  const elapsedDays = daysSinceDelivery ?? (noteDays ? Number(noteDays[1]) : null);
  if (order.status !== 'Delivered') {
    return { eligible: false, reason: 'NOT_DELIVERED', order, daysSinceDelivery: elapsedDays };
  }
  if (opened === true) {
    return { eligible: false, reason: 'OPENED_PRODUCT', order, daysSinceDelivery: elapsedDays };
  }
  if (elapsedDays !== null && elapsedDays > 7) {
    return { eligible: false, reason: 'OUTSIDE_RETURN_WINDOW', order, daysSinceDelivery: elapsedDays };
  }
  if (opened === null || elapsedDays === null) {
    return { eligible: null, reason: 'MORE_INFORMATION_REQUIRED', order, daysSinceDelivery: elapsedDays };
  }
  return { eligible: true, reason: 'WITHIN_RETURN_WINDOW', order, daysSinceDelivery: elapsedDays };
}

export function getShippingQuote(orderValue) {
  const value = Number(orderValue);
  if (!Number.isFinite(value) || value < 0) {
    return { eligible: false, reason: 'INVALID_ORDER_VALUE', fee: null };
  }
  return { eligible: true, fee: value > 499 ? 0 : 50, currency: 'INR' };
}

export function checkCodEligibility(orderValue) {
  const value = Number(orderValue);
  if (!Number.isFinite(value) || value < 0) {
    return { eligible: false, reason: 'INVALID_ORDER_VALUE' };
  }
  return { eligible: value <= 2500, maximumValue: 2500, currency: 'INR' };
}

export const supportTools = {
  get_order_details: ({ order_id }) => getOrderDetails(order_id),
  get_product_details: ({ product_query }) => getProductDetails(product_query),
  check_cancellation_eligibility: ({ order_id }) => checkCancellationEligibility(order_id),
  check_return_eligibility: ({ order_id, opened, days_since_delivery }) =>
    checkReturnEligibility(order_id, { opened, daysSinceDelivery: days_since_delivery }),
  get_shipping_quote: ({ order_value }) => getShippingQuote(order_value),
  check_cod_eligibility: ({ order_value }) => checkCodEligibility(order_value)
};

export function runSupportTool(toolName, args) {
  const tool = supportTools[toolName];
  return tool ? tool(args || {}) : { error: `Unknown support tool: ${toolName}` };
}

export function detectOrderId(input) {
  const match = String(input || '').match(/\bORD-\d+\b/i);
  return match ? match[0].toUpperCase() : null;
}

export function contextualizeFollowUp(text, pendingIntent, pendingOrderId = null, lastOrderId = null) {
  const orderId = detectOrderId(text);
  if (orderId && pendingIntent) {
    if (pendingIntent === 'ORDER_TRACKING') return `track order ${orderId}`;
    if (pendingIntent === 'CANCEL_ORDER') return `cancel order ${orderId}`;
    if (pendingIntent === 'RETURNS') return `return order ${orderId}`;
  }

  if (pendingIntent === 'RETURNS' && pendingOrderId && /unopened|unused|opened|used|khola|use kiya/i.test(text)) {
    return `return order ${pendingOrderId} ${text}`;
  }

  const productContextOrderId = lastOrderId || pendingOrderId;
  if (productContextOrderId && (pendingIntent === 'PRODUCT_QUESTION' || lastOrderId) &&
      /\b(this|that)\s+(product|item)\b|\b(product|item)\s+(details|ingredients|information)\b|\b(its|their)\s+(ingredients|benefits|directions|usage|skin type)\b|\b(ingredients|contain|made of|sensitive skin|skin type|benefits|how to use|directions|safe for|good for)\b/i.test(text)) {
    return `product details ${productContextOrderId} ${text}`;
  }

  return text;
}

export function isAwaitingClarification(reply) {
    return /\b(?:share|provide)\b.{0,50}\b(?:your\s+|the\s+)?(?:order id|order number)\b|\b(?:order id|order number)\b.{0,50}\b(?:share|provide)\b|could you please check.{0,30}order id|check the order id|id dobara check|was the product unopened|product unopened and unused|unopened and unused\?|which product are you asking about|are you (?:asking about|looking for) (?:a particular product|ingredients|suitability|usage|a particular|a specific|one of those details)/i.test(String(reply || ''));
}

function containsAny(text, phrases) {
  return phrases.some((phrase) => text.includes(phrase));
}

function mentionsOpenedProduct(text) {
  return /\b(opened|open|used)\b|\b(khola|use kiya)\b/i.test(text);
}

function isGreetingOnly(text) {
  return /^(hi|hello|hey|good morning|good evening|namaste)[!,.\s]*$/i.test(String(text || '').trim());
}

function isArrivalQuestion(text) {
  return containsAny(text, ['when will', 'when can', 'when should', 'when does', 'when is', 'expected delivery', 'delivery date', 'delivery time', 'arrive', 'reach me', 'come to me', 'deliver to me', 'kab aayega', 'deliver kab']) || /\beta\b/i.test(text);
}

function isCancellationStatusQuestion(text) {
  return /\b(?:is|was|has|have|did)\b.{0,40}\bcancel(?:led|ed)?\b|\bcancellation status\b|\bstatus\b.{0,30}\bcancel/i.test(text);
}

function getOrderStatusReply(orderId, arrivalQuestion = false) {
  if (!orderId) return 'Please share your order ID so I can check the status.';

  const order = runSupportTool('get_order_details', { order_id: orderId });
  if (!order) return 'I couldn’t locate an order with that number. Please check the order ID and try again.';

  if (order.status === 'Delivered') {
    return `Order ${order.order_id} has already been delivered. ${order.notes}`;
  }
  if (order.status === 'Out for Delivery') {
    return `Order ${order.order_id} is out for delivery and is expected by 6 PM today. The courier is ${order.notes.split('.')[0]}.`;
  }
  if (arrivalQuestion) {
    return `Order ${order.order_id} is still Processing. Aura’s standard delivery time is 3–5 business days; the sample order data does not give a specific delivery date yet.`;
  }
  return `Order ${order.order_id} is currently ${order.status}. ${order.notes}`;
}

function getProductReply(product, question) {
  const lower = String(question || '').toLowerCase();
  if (containsAny(lower, ['tell me about', 'more about', 'describe', 'what products'])) {
    return `${product.name} is listed in the sample order data, but no product description was provided. I can’t verify its ingredients, benefits, skin-type suitability, or directions. Are you looking for one of those details, or help with an order containing it?`;
  }
  if (containsAny(lower, ['ingredient', 'what is in', 'made of', 'contain', 'sensitive skin', 'skin type', 'benefit', 'what does it do', 'how to use', 'directions', 'apply', 'safe for', 'good for'])) {
    return `I found ${product.name}. Ingredients, benefits, skin-type suitability, and usage directions were not provided in the supplied product information, so I can’t verify those details or guess. I can help with an order containing this product if you share its order ID.`;
  }
  return `${product.name} is listed in Aura Skincare’s sample product information. Ingredients, skin-type suitability, benefits, and usage directions were not provided, so I can’t verify product claims or guess. Are you asking about a specific detail or an order containing it?`;
}

function getHinglishProductReply(product, question) {
  const lower = String(question || '').toLowerCase();
  if (containsAny(lower, ['ingredient', 'what is in', 'made of', 'contain', 'sensitive skin', 'skin type', 'benefit', 'how to use', 'directions', 'safe for', 'good for'])) {
    return `${product.name} ke ingredients, benefits, skin-type suitability aur use karne ke tareeke ki details supplied information mein nahi di gayi hain. Main andaza nahi lagaungi. Order se judi madad ke liye order ID share kar sakte hain.`;
  }
  return `${product.name} sample product list mein hai. Iske baare mein verified description ya claims nahi diye gaye hain. Kya aap ingredients, suitability, use, ya order ke baare mein pooch rahe hain?`;
}

function getHinglishOrderStatusReply(orderId, arrivalQuestion = false) {
  if (!orderId) return 'Order status check karne ke liye order ID share kar dijiye.';
  const order = runSupportTool('get_order_details', { order_id: orderId });
  if (!order) return 'Mujhe yeh order ID nahi mila. Kripya ID dobara check karke batayein.';
  if (order.status === 'Delivered') return `Order ${orderId} pehle hi deliver ho chuka hai. ${order.notes}`;
  if (order.status === 'Out for Delivery') return `Aapka order ${orderId} aaj shaam 6 baje tak deliver hone ki umeed hai. Courier ${order.notes.split('.')[0]} hai.`;
  if (arrivalQuestion) return `Aapka order ${orderId} abhi Processing mein hai. Standard delivery 3–5 business days hoti hai; sample data mein exact date nahi di gayi hai.`;
  return `Aapka order ${orderId} abhi ${order.status} status mein hai. ${order.notes}`;
}

export function buildSummary(transcript, intent = 'UNKNOWN', orderId = null, resolutionStatus = 'IN_PROGRESS', overrideSummary = null) {
  const customerMessages = transcript.filter((msg) => msg.role === 'customer').map((msg) => msg.text);
  const customerText = customerMessages.join(' ');
  const lastAgentMessage = transcript.filter((msg) => msg.role === 'agent').at(-1)?.text;
  const order = orderId ? getOrderDetails(orderId) : null;
  const summaryParts = [
    customerText ? `Customer asked: ${customerText}.` : 'No customer message was recorded.',
    order ? `Order ${order.order_id} (${order.product}) is ${order.status}. ${order.notes}` : '',
    lastAgentMessage ? `Agent responded: ${lastAgentMessage}` : ''
  ].filter(Boolean);
  const summaryText = overrideSummary || summaryParts.join(' ');

  return {
    customer_intent: intent,
    order_id: orderId,
    resolution_status: resolutionStatus,
    call_summary: summaryText
  };
}

function generateEnglishReply(message) {
  const text = String(message || '').trim();

  if (!text) {
    return "I couldn’t catch that. Could you please repeat what you need help with?";
  }

  const lower = text.toLowerCase();
  const orderId = detectOrderId(text);

  if (containsAny(lower, ['mera order', 'order kahan', 'order kaha', 'kab aayega', 'deliver kab'])) {
    if (!orderId) {
      return 'Aapka order check karne ke liye order ID share kar dijiye, jaise ORD-101.';
    }
    const order = runSupportTool('get_order_details', { order_id: orderId });
    if (!order) {
      return 'Mujhe is order ID ka record nahi mila. Kripya ID dobara check karke batayein.';
    }
    if (order.status === 'Out for Delivery') {
      return `Aapka order ${order.order_id} aaj shaam 6 baje tak deliver hone ki umeed hai. Courier ${order.notes.split('.')[0]} hai.`;
    }
    return `Aapka order ${order.order_id} abhi ${order.status} status mein hai. ${order.notes}`;
  }

  if (containsAny(lower, ['mujhe cancel', 'cancel karna', 'cancel karo', 'order cancel'])) {
    if (!orderId) {
      return 'Cancellation eligibility check karne ke liye apna order ID share kar dijiye.';
    }
    const result = runSupportTool('check_cancellation_eligibility', { order_id: orderId });
    if (result.reason === 'ORDER_NOT_FOUND') {
      return 'Mujhe is order ID ka record nahi mila. Kripya ID dobara check karke batayein.';
    }
    return result.eligible
      ? `Aapka order ${orderId} abhi Processing mein hai aur cancellation ke liye eligible hai.`
      : 'Maaf kijiye, order ship hone ke baad cancel nahi ho sakta. Aap delivery ke waqt package refuse kar sakte hain.';
  }

  if (containsAny(lower, ['return karna', 'wapas karna', 'refund chahiye'])) {
    if (!orderId) {
      return 'Return eligibility check karne ke liye order ID aur batayein ki product unopened hai ya nahi.';
    }
    const result = runSupportTool('check_return_eligibility', {
      order_id: orderId,
      opened: containsAny(lower, ['opened', 'khola', 'use kiya']) ? true : null
    });
    if (result.reason === 'ORDER_NOT_FOUND') {
      return 'Mujhe is order ID ka record nahi mila. Kripya ID dobara check karke batayein.';
    }
    if (result.reason === 'OUTSIDE_RETURN_WINDOW') {
      return `Maaf kijiye, order ${orderId} delivery ke ${result.daysSinceDelivery} din baad hai, jabki return 7 din ke andar hona chahiye.`;
    }
    if (result.reason === 'OPENED_PRODUCT') {
      return 'Maaf kijiye, regular return sirf unopened aur unused product ke liye 7 din ke andar accept hota hai.';
    }
    return 'Return ke liye product unopened aur unused hona chahiye aur delivery ke 7 din ke andar request karni hoti hai. Kya aapka product unopened hai?';
  }

  if (containsAny(lower, ['mera order', 'kya haal', 'batao na'])) {
    return 'Main order status, shipping, returns aur cancellation mein madad kar sakti hoon. Aap kis cheez ke baare mein poochna chahte hain?';
  }

  if (isGreetingOnly(lower)) {
    return "Hi! I’m Aria from Aura Skincare. I can help with order tracking, shipping, returns, cancellations, and product support. How can I help you today?";
  }

  if (isCancellationStatusQuestion(lower)) {
    if (!orderId) return 'Please share your order ID so I can check its current status. This demo only checks eligibility and cannot confirm a cancellation was submitted.';
    const order = runSupportTool('get_order_details', { order_id: orderId });
    if (!order) return 'I couldn’t locate that order ID. Please check it and try again.';
    return `Order ${order.order_id} is currently ${order.status}. I can check its status, but this demo cannot submit a cancellation or confirm that one was submitted. The order has not been changed. ${order.notes}`;
  }

  const statusQuestion = containsAny(lower, ['where is my order', 'track my order', 'delivery status', 'status of my order', 'order status', 'has my order', 'is my order', 'did my order', 'has it shipped', 'was it shipped', 'where is order']) ||
    /\b(?:order|ord-\d+)\b.{0,40}\b(?:status|shipped|delivered|processing|dispatched|tracking)\b/i.test(lower);
  if (statusQuestion || (orderId && isArrivalQuestion(lower))) {
    return getOrderStatusReply(orderId, isArrivalQuestion(lower));
  }

  if (containsAny(lower, ['damaged', 'defective', 'broken', 'arrived damaged', 'leaking', 'broken seal'])) {
    return 'I’m sorry the item arrived damaged. Aura’s policy is to report damaged or defective items within 48 hours of delivery and provide photos for a replacement review. This demo can explain the policy, but it cannot upload photos or submit a replacement request.';
  }

  if (containsAny(lower, ['return', 'refund', 'exchange'])) {
    const mentionedDays = lower.match(/\b(\d+)\s+days?\b/);
    if (mentionedDays && Number(mentionedDays[1]) > 7) {
      return `I’m sorry, but a return requested ${mentionedDays[1]} days after delivery is outside Aura Skincare’s 7-day return window. Regular returns must also be unopened and unused.`;
    }
    if (mentionsOpenedProduct(lower)) {
      return 'I’m sorry, but regular returns are accepted only within 7 days of delivery for unopened, unused products in original packaging.';
    }
    if (orderId) {
      const result = runSupportTool('check_return_eligibility', {
        order_id: orderId,
        opened: mentionsOpenedProduct(lower) ? true : null
      });
      if (result.reason === 'OUTSIDE_RETURN_WINDOW') {
        return `I’m sorry, but order ${orderId} was delivered ${result.daysSinceDelivery} days ago. Returns are accepted within 7 days for unopened, unused products in original packaging.`;
      }
      if (result.reason === 'OPENED_PRODUCT') {
        return 'I’m sorry, but regular returns are accepted only for unopened, unused products in original packaging, within 7 days of delivery.';
      }
      if (result.reason === 'NOT_DELIVERED') {
        return `Order ${orderId} has not been delivered yet; its current status is ${result.order.status}. Return eligibility can be checked after delivery. Aura accepts regular returns within 7 days of delivery for unopened, unused products in original packaging.`;
      }
      if (result.reason === 'ORDER_NOT_FOUND') {
        return 'I couldn’t locate an order with that number. Could you please check the order ID?';
      }
    }

    return orderId
      ? 'Returns are accepted within 7 days of delivery for unopened, unused products in original packaging. Was the product unopened and unused when delivered?'
      : 'I can check that for you. Please share the order ID and confirm whether the product is unopened and unused. Returns are accepted within 7 days of delivery.';
  }

  if (containsAny(lower, ['cancel', 'cancellation'])) {
    if (orderId) {
      const result = runSupportTool('check_cancellation_eligibility', { order_id: orderId });
      const order = result.order;
      if (result.eligible) {
        return `Your order ${order.order_id} is still in Processing and appears eligible for cancellation. This demo can check eligibility but cannot submit the cancellation request.`;
      }
      if (order && ['Shipped', 'Out for Delivery'].includes(order.status)) {
        return 'I’m sorry, but once the order is Shipped or Out for Delivery, it cannot be cancelled. Customers may refuse the package at the doorstep instead.';
      }
      if (!order) {
        return 'I couldn’t find that order. Please check the order ID and share it again.';
      }
    }

    return 'Please share your order ID so I can check whether it is still in Processing. Orders can only be cancelled before they are shipped.';
  }

  if (containsAny(lower, ['cash on delivery', 'cod', 'upi', 'pay on delivery'])) {
    if (orderId) {
      const order = runSupportTool('get_order_details', { order_id: orderId });
      if (!order) return 'I couldn’t find that order. Please check the order ID and share it again.';
      const eligibility = runSupportTool('check_cod_eligibility', { order_value: order.value });
      return eligibility.eligible
        ? `COD is available for your ₹${order.value} order. You can pay by cash or UPI at the doorstep.`
        : 'COD is available only for orders up to ₹2,500. This order is above that limit.';
    }
    return 'Cash on Delivery is available for orders up to ₹2,500. Customers can pay by cash or UPI at the doorstep.';
  }

  if (containsAny(lower, ['shipping', 'delivery charge', 'delivery fee', 'shipping fee', 'how much is delivery'])) {
    if (orderId) {
      const order = runSupportTool('get_order_details', { order_id: orderId });
      if (!order) return 'I couldn’t find that order. Please check the order ID and share it again.';
      const quote = runSupportTool('get_shipping_quote', { order_value: order.value });
      return quote.fee === 0
        ? `Order ${orderId} is ₹${order.value}, so delivery is free.`
        : `Order ${orderId} is ₹${order.value}, so the shipping fee is ₹${quote.fee}.`;
    }
    return 'Free delivery is available on orders above ₹499. Orders below ₹499 have a shipping fee of ₹50, and standard delivery takes 3–5 business days.';
  }

  if (containsAny(lower, ['book a flight', 'flight to goa', 'hotel booking', 'travel booking', 'plan a trip'])) {
    return 'I can only help with Aura Skincare products, orders, and support policies. I can’t help book travel.';
  }

  const product = runSupportTool('get_product_details', { product_query: text });
  if (product) {
    return getProductReply(product, text);
  }

  if (containsAny(lower, ['product', 'serum', 'sunscreen', 'face wash', 'toner', 'skincare', 'ingredients', 'skin type', 'benefits'])) {
    return 'I don’t have enough product information to answer that accurately. The supplied data only lists sample product names. Which product are you asking about? I can also help with orders, delivery, returns, and cancellation eligibility.';
  }

  return 'I can only help with Aura Skincare products, order tracking, shipping, returns, cancellation eligibility, and COD. I don’t have enough information to answer that specific question. Which of those topics can I help with?';
}

function generateHinglishReply(message) {
  const text = String(message || '').trim();
  const lower = text.toLowerCase();
  const orderId = detectOrderId(text);

  if (!text) return 'Sorry, aapki baat clear nahi sunai di. Kripya dobara bolenge?';
  if (containsAny(lower, ['flight', 'hotel', 'travel', 'goa'])) {
    return 'Main sirf Aura Skincare ke products aur orders mein madad kar sakti hoon. Travel booking mein help nahi kar paungi.';
  }
  if (/\b(?:is|was|has|have|did)\b.{0,40}\bcancel(?:led|ed)?\b|\bcancellation status\b/i.test(lower)) {
    if (!orderId) return 'Current order status check karne ke liye order ID share kijiye. Yeh demo actual cancellation submit nahi karta.';
    const order = runSupportTool('get_order_details', { order_id: orderId });
    if (!order) return 'Mujhe yeh order ID nahi mila. Kripya ID dobara check karke batayein.';
    return `Order ${orderId} abhi ${order.status} status mein hai. Yeh demo cancellation submit nahi karta. ${order.notes}`;
  }
  if (orderId && isArrivalQuestion(lower)) {
    return getHinglishOrderStatusReply(orderId, true);
  }
  if (containsAny(lower, ['damaged', 'defective', 'broken', 'leaking', 'toota', 'damage'])) {
    return 'Mujhe afsos hai ki item damage aaya. Aura policy ke mutabik delivery ke 48 ghante ke andar photos ke saath report karein, taaki replacement review ho sake. Yeh demo photo upload ya replacement request submit nahi karta.';
  }
  if (containsAny(lower, ['cancel', 'cancellation', 'cancel karna', 'cancel karo'])) {
    if (!orderId) return 'Cancellation check karne ke liye apna order ID share kar dijiye.';
    const result = runSupportTool('check_cancellation_eligibility', { order_id: orderId });
    if (result.reason === 'ORDER_NOT_FOUND') return 'Mujhe yeh order ID nahi mila. Kripya ID dobara check karke batayein.';
    return result.eligible
      ? `Aapka order ${orderId} abhi Processing mein hai, isliye cancellation ke liye eligible hai.`
      : `Maaf kijiye, order ${orderId} ship ho chuka hai ya deliver ho gaya hai, isliye cancel nahi ho sakta.`;
  }
  if (containsAny(lower, ['return', 'refund', 'wapas', 'exchange'])) {
    const mentionedDays = lower.match(/\b(\d+)\s+days?\b/);
    if (mentionedDays && Number(mentionedDays[1]) > 7) {
      return `Maaf kijiye, delivery ke ${mentionedDays[1]} din baad return request 7-day return window ke bahar hai.`;
    }
    if (mentionsOpenedProduct(lower)) {
      return 'Maaf kijiye, regular return sirf delivery ke 7 din ke andar unopened aur unused products ke liye hota hai.';
    }
    if (!orderId) return 'Return check karne ke liye order ID aur yeh batayein ki product unopened aur unused hai ya nahi.';
    const result = runSupportTool('check_return_eligibility', {
      order_id: orderId,
      opened: mentionsOpenedProduct(lower) ? true : null
    });
    if (result.reason === 'ORDER_NOT_FOUND') return 'Mujhe yeh order ID nahi mila. Kripya ID dobara check karke batayein.';
    if (result.reason === 'OUTSIDE_RETURN_WINDOW') return `Maaf kijiye, delivery ko ${result.daysSinceDelivery} din ho gaye hain. Return 7 din ke andar hi hota hai.`;
    if (result.reason === 'OPENED_PRODUCT') return 'Maaf kijiye, regular return sirf unopened aur unused products ke liye hota hai.';
    return 'Return delivery ke 7 din ke andar, unopened aur unused product ke liye available hai. Kya product unopened hai?';
  }
  if (containsAny(lower, ['where is', 'track', 'status', 'kahan', 'kaha', 'mera order', 'order status'])) {
    return orderId ? getHinglishOrderStatusReply(orderId) : 'Order status check karne ke liye order ID share kar dijiye, jaise ORD-101.';
  }
  if (containsAny(lower, ['shipping', 'delivery fee', 'delivery charge', 'shipping fee'])) {
    if (orderId) {
      const order = runSupportTool('get_order_details', { order_id: orderId });
      if (!order) return 'Mujhe yeh order ID nahi mila. Kripya ID dobara check karke batayein.';
      const quote = runSupportTool('get_shipping_quote', { order_value: order.value });
      return quote.fee === 0
        ? `Order ${orderId} ₹${order.value} ka hai, isliye delivery free hai.`
        : `Order ${orderId} ₹${order.value} ka hai, isliye shipping fee ₹${quote.fee} hai.`;
    }
    return '₹499 se zyada ke order par delivery free hai. ₹499 ya usse kam ke order par ₹50 shipping fee hai. Delivery aam taur par 3–5 business days leti hai.';
  }
  if (containsAny(lower, ['cod', 'cash on delivery', 'upi', 'pay on delivery'])) {
    if (orderId) {
      const order = runSupportTool('get_order_details', { order_id: orderId });
      if (!order) return 'Mujhe yeh order ID nahi mila. Kripya ID dobara check karke batayein.';
      const eligibility = runSupportTool('check_cod_eligibility', { order_value: order.value });
      return eligibility.eligible
        ? `Aapke ₹${order.value} order par COD available hai. Doorstep par cash ya UPI se payment kar sakte hain.`
        : 'COD sirf ₹2,500 tak ke orders par available hai. Yeh order limit se zyada hai.';
    }
    return '₹2,500 tak ke orders par COD available hai. Doorstep par cash ya UPI se payment kar sakte hain.';
  }
  const product = runSupportTool('get_product_details', { product_query: text });
  if (product) {
    return getHinglishProductReply(product, text);
  }
  if (/\b(hi|hello|hey|namaste)\b/.test(lower)) {
    return 'Namaste! Main Aura Skincare se Aria hoon. Main order tracking, delivery, returns aur cancellation mein madad kar sakti hoon. Bataiye, main kya help karun?';
  }
  if (containsAny(lower, ['damaged', 'defective', 'broken', 'toota', 'damage'])) {
    return 'Damaged ya defective product ki delivery ke 48 ghante ke andar photos ke saath report karein, taaki replacement ke liye madad ki ja sake.';
  }
  return 'Main Aura Skincare ke order tracking, shipping, returns, cancellation aur COD ke baare mein madad kar sakti hoon. Aap kya poochna chahenge?';
}

export function generateAgentReply(message, language = 'en-IN') {
  return language === 'hi-IN' ? generateHinglishReply(message) : generateEnglishReply(message);
}

export function classifyIntent(message) {
  const text = String(message || '').toLowerCase();
  if (containsAny(text, ['track', 'order status', 'where is my order', 'delivery status', 'mera order', 'kahan', 'kaha'])) return 'ORDER_TRACKING';
  if (containsAny(text, ['return', 'refund', 'exchange', 'wapas'])) return 'RETURNS';
  if (containsAny(text, ['damaged', 'defective', 'broken', 'leaking'])) return 'DAMAGED_ITEM';
  if (containsAny(text, ['cancel', 'cancellation', 'cancel karna'])) return 'CANCEL_ORDER';
  if (containsAny(text, ['shipping', 'delivery fee', 'cod', 'cash on delivery'])) return 'SHIPPING_POLICY';
  if (getProductDetails(text)) return 'PRODUCT_QUESTION';
  if (isGreetingOnly(text)) return 'GREETING';
  return 'GENERAL_SUPPORT';
}
