import { execFileSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'hardware_tools.py');

function run(args) {
  const out = execFileSync('python3', [SCRIPT, ...args], {
    encoding: 'utf8',
    timeout: 120000,
  });
  return JSON.parse(out);
}

export default function (api) {
  api.registerTool({
    name: 'hw_query_packages',
    description: '按手机尾号查询在库包裹状态和位置。必须调用此工具才能回答：用户有没有新包裹、包裹在哪个格口、几号货架等问题。不得凭空回答，必须查询后再回复。',
    parameters: {
      type: 'object',
      properties: {
        phone_suffix: {
          type: 'string',
          description: '手机号后4位，例如 "1234"',
        },
      },
      required: ['phone_suffix'],
    },
    handler: ({ phone_suffix }) => run(['query_packages', '--phone', phone_suffix]),
  });

  api.registerTool({
    name: 'hw_get_busyness',
    description: '查询驿站当前忙闲状态，返回忙闲等级（低/中/高）和在库件数。必须调用此工具才能回答：现在人多吗、现在去取件方便吗、驿站忙不忙等问题。',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: () => run(['get_busyness']),
  });

  api.registerTool({
    name: 'hw_create_anomaly',
    description: '记录出库异常工单。当用户说包裹已签收/已取但实际没有拿到时，必须调用此工具生成工单，自动预填快递单号、商品信息、格口、驿站名称和时间。入库异常由系统自动上报，无需调用此工具。',
    parameters: {
      type: 'object',
      properties: {
        phone_suffix: {
          type: 'string',
          description: '用户手机号后4位',
        },
        tracking_number: {
          type: 'string',
          description: '快递单号（可选，未提供时自动从数据库查找）',
        },
        description: {
          type: 'string',
          description: '异常描述',
        },
      },
      required: ['phone_suffix'],
    },
    handler: ({ phone_suffix, tracking_number = '', description = '' }) => {
      const args = ['create_anomaly', '--phone', phone_suffix];
      if (tracking_number) args.push('--tracking', tracking_number);
      if (description) args.push('--desc', description);
      return run(args);
    },
  });

  api.registerTool({
    name: 'hw_prepare_pickup',
    description: '为用户预约取件。当用户说"X分钟后到"或"快到了"时调用。eta_minutes>0时立即返回预约成功，后台倒计时结束后再驱动机械臂出库并推送大屏提示；eta_minutes=0时立即出库。调用前须向用户确认。',
    parameters: {
      type: 'object',
      properties: {
        phone_suffix: {
          type: 'string',
          description: '用户手机号后4位',
        },
        eta_minutes: {
          type: 'integer',
          description: '预计到达分钟数，0表示立即执行',
          default: 0,
        },
      },
      required: ['phone_suffix'],
    },
    handler: ({ phone_suffix, eta_minutes = 0 }) => {
      const args = ['prepare_pickup', '--phone', phone_suffix, '--eta', String(eta_minutes)];
      if (eta_minutes > 0) {
        // 后台运行，立即返回预约确认
        spawn('python3', [SCRIPT, ...args], { detached: true, stdio: 'ignore' }).unref();
        return {
          status: 'scheduled',
          eta_minutes,
          message: `已预约，将在 ${eta_minutes} 分钟后为您准备包裹，请准时前往出口区取件`,
        };
      }
      return run(args);
    },
  });
}
