import 'server-only';
import {cookies} from 'next/headers';
import {adminAuth} from '@/lib/firebase/admin';
export const SESSION_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-studioshot_session' : 'studioshot_session';
export async function currentUser(){const value=(await cookies()).get(SESSION_COOKIE)?.value;if(!value)return null;try{const d=await adminAuth.verifySessionCookie(value,true);return{uid:d.uid,email:d.email??null,name:d.name??null}}catch{return null}}
export async function requireUser(){const user=await currentUser();if(!user)throw Object.assign(new Error('Sign in to continue.'),{status:401,code:'UNAUTHENTICATED'});return user}
