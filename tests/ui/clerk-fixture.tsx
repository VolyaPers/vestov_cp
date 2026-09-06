import type { ReactNode } from 'react'
const getToken=async()=>null
const signOut=async()=>{await fetch('/api/__fixture__/logout',{method:'POST'})}
const auth={isLoaded:true,isSignedIn:true,getToken,signOut}
const identity={id:'isolated-ui-fixture'}
export const useAuth=()=>auth
export const useUser=()=>({user:identity,isLoaded:true,isSignedIn:true})
export const ClerkProvider=({children}:{children:ReactNode})=><>{children}</>
export const UserButton=()=> <span aria-label="Test identity provider">QA</span>
export const Show=({when,children}:{when:string,children:ReactNode})=>when==='signed-in'?<>{children}</>:null
export const SignInButton=({children}:{children:ReactNode})=><>{children}</>
