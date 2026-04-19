import { NextRequest, NextResponse } from 'next/server';
import { validateAdminSession, createAdminClient } from '@/lib/server/admin-auth';
import { getSystemConfig } from '@/lib/config/system-config';

export async function GET() {
  try {
    const systemConfig = getSystemConfig();
    const [configs, adminEmails] = await Promise.all([
      systemConfig.getAllConfigs(),
      Promise.resolve(process.env.ADMIN_EMAILS?.split(',') || ['2200691917@qq.com'])
    ]);

    const maintenanceConfig = await systemConfig.getMaintenanceConfig();

    return NextResponse.json({
      success: true,
      data: {
        adminEmails,
        systemMode: maintenanceConfig.mode ? 'maintenance' : 'production',
        maintenanceMessage: maintenanceConfig.message,
        enableApiLogging: configs.enable_api_logging || true,
        enableErrorAlerts: configs.enable_error_alerts || true,
        alertEmail: configs.alert_email || '2200691917@qq.com',
        allConfigs: configs
      }
    });

  } catch (error: any) {
    console.error('获取系统配置失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '获取配置失败' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status }
      );
    }

    const supabaseAdmin = createAdminClient();
    const body = await request.json();
    const systemConfig = getSystemConfig();
    
    // 更新维护模式
    if (body.systemMode !== undefined) {
      const isMaintenance = body.systemMode === 'maintenance';
      await systemConfig.updateConfig('system_maintenance_mode', isMaintenance, '系统维护模式');
      
      if (body.maintenanceMessage && isMaintenance) {
        await systemConfig.updateConfig('system_maintenance_message', body.maintenanceMessage, '维护模式提示消息');
      }
    }

    // 更新其他配置
    const updates = [];
    
    if (body.enableApiLogging !== undefined) {
      updates.push(systemConfig.updateConfig('enable_api_logging', body.enableApiLogging, 'API日志记录'));
    }
    
    if (body.enableErrorAlerts !== undefined) {
      updates.push(systemConfig.updateConfig('enable_error_alerts', body.enableErrorAlerts, '错误告警'));
    }
    
    if (body.alertEmail) {
      updates.push(systemConfig.updateConfig('alert_email', body.alertEmail, '告警邮箱'));
    }

    await Promise.all(updates);

    // 获取更新后的配置
    const [configs, maintenanceConfig] = await Promise.all([
      systemConfig.getAllConfigs(),
      systemConfig.getMaintenanceConfig()
    ]);

    return NextResponse.json({
      success: true,
      message: '系统配置已更新',
      data: {
        systemMode: maintenanceConfig.mode ? 'maintenance' : 'production',
        maintenanceMessage: maintenanceConfig.message,
        enableApiLogging: configs.enable_api_logging || true,
        enableErrorAlerts: configs.enable_error_alerts || true,
        alertEmail: configs.alert_email || '2200691917@qq.com'
      }
    });
    
  } catch (error: any) {
    console.error('更新系统配置失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '更新失败' },
      { status: 500 }
    );
  }
}