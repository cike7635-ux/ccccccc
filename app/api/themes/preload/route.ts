import { NextRequest, NextResponse } from 'next/server';
import { getUserData } from '@/lib/server/auth';
import { listMyThemes } from '@/app/themes/actions';

export async function GET(request: NextRequest) {
  try {
    console.log('🎯 主题预加载API被调用');
    
    // 验证用户登录状态
    const { user, profile } = await getUserData();
    
    if (!user) {
      return NextResponse.json(
        { error: '未登录用户' },
        { status: 401 }
      );
    }
    
    console.log(`🎯 预加载主题数据 - 用户: ${user.email}`);
    
    // 预加载主题列表（触发缓存）
    const { data: themes, error } = await listMyThemes();
    
    if (error) {
      console.error('预加载主题失败:', error);
      return NextResponse.json(
        { error: '预加载失败' },
        { status: 500 }
      );
    }
    
    console.log(`🎯 预加载成功 - 主题数量: ${themes?.length || 0}`);
    
    return NextResponse.json({
      success: true,
      themesCount: themes?.length || 0,
      message: '主题数据预加载完成'
    });
    
  } catch (error) {
    console.error('预加载API错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}