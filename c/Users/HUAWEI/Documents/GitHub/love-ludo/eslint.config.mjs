import { defineConfig } from 'eslint/config';
import next from 'eslint-config-next';

const eslintConfig = defineConfig([
  ...next,
  {
    // 自定义规则覆盖
    rules: {
      // 禁用未使用变量的警告
      '@typescript-eslint/no-unused-vars': 'off',
      // 允许使用any类型
      '@typescript-eslint/no-explicit-any': 'off',
      // 允许未转义的HTML实体
      'react/no-unescaped-entities': 'off',
      // 允许Hook依赖缺失
      'react-hooks/exhaustive-deps': 'off'
    }
  }
]);

export default eslintConfig;