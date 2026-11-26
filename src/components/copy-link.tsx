'use client';export default function CopyLink({url}:{url:string}){return <button className="btn light" type="button" onClick={()=>navigator.clipboard.writeText(url)}>Copy link</button>}
