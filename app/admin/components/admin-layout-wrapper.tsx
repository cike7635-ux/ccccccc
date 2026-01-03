// // /app/admin/components/admin-layout-wrapper.tsx
// 'use client'

// import { ReactNode, useEffect } from 'react'

// interface AdminLayoutWrapperProps {
//   children: ReactNode
// }

// export default function AdminLayoutWrapper({ children }: AdminLayoutWrapperProps) {
//   useEffect(() => {
//     // 保存原始body样式
//     const originalBodyStyle = document.body.style.cssText
//     const originalHtmlStyle = document.documentElement.style.cssText
    
//     // 设置全屏样式
//     document.body.style.cssText = `
//       position: fixed;
//       top: 0;
//       left: 0;
//       right: 0;
//       bottom: 0;
//       margin: 0;
//       padding: 0;
//       overflow-x: hidden;
//       background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
//     `
    
//     document.documentElement.style.cssText = `
//       height: 100%;
//       width: 100%;
//       margin: 0;
//       padding: 0;
//     `
    
//     // 隐藏导航元素
//     const hideElements = () => {
//       const elementsToHide = [
//         ...document.querySelectorAll('nav, footer, [class*="nav"], [class*="Nav"], [class*="bottom"]')
//       ]
      
//       elementsToHide.forEach(el => {
//         if (el instanceof HTMLElement) {
//           el.style.display = 'none'
//           el.style.visibility = 'hidden'
//           el.style.opacity = '0'
//           el.style.height = '0'
//           el.style.overflow = 'hidden'
//         }
//       })
//     }
    
//     hideElements()
//     const intervalId = setInterval(hideElements, 500)
    
//     return () => {
//       document.body.style.cssText = originalBodyStyle
//       document.documentElement.style.cssText = originalHtmlStyle
//       clearInterval(intervalId)
//     }
//   }, [])
  
//   return (
//     <div 
//       className="admin-container"
//       style={{
//         position: 'fixed',
//         top: 0,
//         left: 0,
//         right: 0,
//         bottom: 0,
//         overflowY: 'auto',
//         background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
//         padding: '1rem'
//       }}
//     >
//       {children}
//     </div>
//   )
// }