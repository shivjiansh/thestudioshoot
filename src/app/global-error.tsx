"use client";
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body><main style={{minHeight:"100vh",display:"grid",placeContent:"center",padding:24,fontFamily:"Arial,sans-serif",background:"#f8f4ed",color:"#191815"}}><h1>TheStudioShot encountered an error.</h1><p>Please retry. If the problem continues, contact support.</p><button onClick={reset} style={{padding:"12px 18px",border:0,borderRadius:24,background:"#191815",color:"white",cursor:"pointer"}}>Try again</button></main></body></html>;
}
