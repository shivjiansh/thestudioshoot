import {NextResponse} from 'next/server';
export class HttpError extends Error{constructor(public code:string,message:string,public status=400){super(message)}}
export function rid(req:Request){return req.headers.get('x-request-id')||crypto.randomUUID()}
export function fail(error:unknown,id:string){const e=error as Error&{status?:number;code?:string};const status=e.status??(e.name==='ZodError'?400:500);const message=status>=500&&process.env.NODE_ENV==='production'?'An unexpected error occurred.':e.message||'Unexpected error';if(status>=500)console.error(JSON.stringify({level:'error',requestId:id,message:e.message}));return NextResponse.json({error:{code:e.code??(status===400?'INVALID_REQUEST':'INTERNAL_ERROR'),message},requestId:id},{status})}
