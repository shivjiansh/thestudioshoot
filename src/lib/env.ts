import 'server-only';
export const env={
 appUrl:process.env.APP_URL??'http://localhost:3000',
 firebaseProjectId:process.env.FIREBASE_PROJECT_ID,
 firebaseClientEmail:process.env.FIREBASE_CLIENT_EMAIL,
 firebasePrivateKey:process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n'),
 firebaseServiceAccount:process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
 openaiKey:process.env.OPENAI_API_KEY,
 openaiImageModel:process.env.OPENAI_IMAGE_MODEL??'gpt-image-2.5-sunburst',
 razorpayKeyId:process.env.RAZORPAY_KEY_ID,razorpayKeySecret:process.env.RAZORPAY_KEY_SECRET,razorpayWebhookSecret:process.env.RAZORPAY_WEBHOOK_SECRET,
 upstashUrl:process.env.UPSTASH_REDIS_REST_URL,upstashToken:process.env.UPSTASH_REDIS_REST_TOKEN
};
export function need(value:string|undefined,name:string){if(!value)throw new Error(`Missing required environment variable: ${name}`);return value}
