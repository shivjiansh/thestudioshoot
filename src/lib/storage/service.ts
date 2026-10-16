import 'server-only';import {storage} from '@/lib/firebase/admin';import {randomUUID} from 'node:crypto';
export async function saveImage(uid:string,jobId:string,dataUrl:string){const m=dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);if(!m)throw new Error('Unexpected generated image format.');const path=`users/${uid}/generated/${jobId}-${randomUUID()}.png`;await storage.bucket().file(path).save(Buffer.from(m[1],'base64'),{resumable:false,metadata:{contentType:'image/png',cacheControl:'private, max-age=0',metadata:{ownerUid:uid,jobId}}});return path}
export async function signedImage(path:string){const [url]=await storage.bucket().file(path).getSignedUrl({action:'read',expires:Date.now()+10*60*1000});return url}

export async function deleteImage(path: string) {
  await storage.bucket().file(path).delete({ ignoreNotFound: true });
}
