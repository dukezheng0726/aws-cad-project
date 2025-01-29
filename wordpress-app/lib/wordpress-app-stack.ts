import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
// import { AutoScalingGroup } from 'aws-cdk-lib/aws-autoscaling'; 
import { aws_autoscaling as autoscaling } from 'aws-cdk-lib';


// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class WordpressAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // //layer2 RDS
    const wordpressRDS = new rds.CfnDBInstance(this, "WordpressRDS", {
      dbInstanceIdentifier: "wordpress-db",
      engine: "mysql",
      engineVersion: '8.0.40',
      dbInstanceClass: "db.t3.micro", 
      allocatedStorage: "20", 
      masterUsername: "admin", 
      masterUserPassword: "Metro123456", 
      dbSubnetGroupName: cdk.Fn.importValue('Application-RDS-SubnetGroup-ID'),
      vpcSecurityGroups:[cdk.Fn.importValue('Application-RDS-SG-ID')],
      publiclyAccessible: false,
      backupRetentionPeriod: 0,
      multiAz: false, 
      dbName: "metrodb"
    });
    new cdk.CfnOutput(this, "RDSInstanceEndpoint", {
      value: wordpressRDS.attrEndpointAddress,
    });

    // layer 1 RDS instance
    // const dbUsername = 'admin';
    // const dbPassword = new cdk.SecretValue('Metro12345');

    // const rdsInstance = new rds.DatabaseInstance(this, 'MyRDSInstance', {
    //   engine: rds.DatabaseInstanceEngine.mysql({
    //     version: rds.MysqlEngineVersion.VER_8_0_35, // 指定 MySQL 版本（目前支持最新为 8.0.x）
    //   }),
    //   instanceType: ec2.InstanceType.of(
    //     ec2.InstanceClass.BURSTABLE2,
    //     ec2.InstanceSize.MICRO
    //   ),
    //   existingVpc,
    //   securityGroups: [ec2.SecurityGroup)],
    //   multiAz: false, 
    //   allocatedStorage: 20, // 指定存储大小（GB）
    //   storageType: rds.StorageType.GP2, // 存储类型
    //   credentials: rds.Credentials.fromPassword(dbUsername, dbPassword), // 自动生成密码，用户名为 admin
    //   databaseName: 'MyDatabase', 
    //   publiclyAccessible: false, 
    //   vpcSubnets: {
    //     subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, // 使用私有子网
    //   },
    //   backupRetention: cdk.Duration.days(0), // 配置备份保留时间
    //   deletionProtection: false, // 是否启用删除保护
    // });


    // EC2-instance template
    const EC2UserData = `
      #!/bin/bash
      echo "Running custom user data script"
      amazon-linux-extras enable php7.4
      sudo yum install -y php php-cli php-fpm php-mysqlnd php-xml php-mbstring php-curl php-zip
      yum install httpd php-mysql -y
      yum update -y
      cd /var/www/html
      echo "healthy" > healthy.html
      wget https://wordpress.org/wordpress-6.7.1.tar.gz
      tar -xzf wordpress-6.7.1.tar.gz
      cp -r wordpress/* /var/www/html/
      rm -rf wordpress
      rm -rf wordpress-6.7.1.tar.gz
      chmod -R 755 wp-content
      chown -R apache:apache wp-content
      service httpd start
      chkconfig httpd on
    `;
    const ec2LaunchTemplate = new ec2.CfnLaunchTemplate(this, 'EC2LaunchTemplate', {
      launchTemplateName: "Wordpress-Launch-Template",
      versionDescription: "v1",
      launchTemplateData: {
        instanceType: 't2.micro',
        imageId: "ami-0d1e3f2707b2b8925",
        userData: cdk.Fn.base64(EC2UserData),
        securityGroupIds: [cdk.Fn.importValue("Application-EC2-SG-ID")]
      },
    }); 

    // ALB

    const wordpressALB = new elbv2.CfnLoadBalancer(this, 'WordpressALB', /* all optional props */  {
      ipAddressType: 'ipv4',
      scheme: 'internet-facing',
      name: 'WordPress-ALB',
      securityGroups: [cdk.Fn.importValue("Application-ALB-SG-ID")],    //此处需要改为ssm
      //subnets: cdk.Fn.importValue("Application-PUBLIC-SUBNET-IDS").split(','),
      subnets: ["subnet-064036dc43f0e4a5e","subnet-0a77deb62508bf083"],
      type: 'application',
    });
    
    new cdk.CfnOutput(this, "ALBDNSName", {
      value: wordpressALB.attrDnsName,
      exportName: "Wordpress-ALB-DNS"
    });

    //ALB-TargetGroup
    const cfnTargetGroup = new elbv2.CfnTargetGroup(this, 'MyCfnTargetGroup', /* all optional props */ {
      healthCheckEnabled: true,
      healthCheckPath: '/healthy.html',
      healthCheckPort: '80',
      healthCheckProtocol: 'HTTP',
      name: 'Wordpress-ALB-TG',
      port: 80,
      protocol: 'HTTP',
      targetType: 'instance',
      vpcId: cdk.Fn.importValue("Application-VPC-ID"),
    });

    //ALB-Listener
    const cfnListener = new elbv2.CfnListener(this, 'MyCfnListener', {
      defaultActions: [{
        type: 'forward',
        targetGroupArn: cfnTargetGroup.attrTargetGroupArn,   //
      }],
      loadBalancerArn: wordpressALB.attrLoadBalancerArn,
      port: 80,
      protocol: 'HTTP',
    });


    // AutoScaling Group
    const cfnAutoScalingGroup = new autoscaling.CfnAutoScalingGroup(this, 'MyCfnAutoScalingGroup', {
      maxSize: '20',
      minSize: '2',
      // the properties below are optional
      autoScalingGroupName: 'Wordpress-ASG',
      desiredCapacity: '2',
      healthCheckType: 'EC2',
      launchTemplate: {
        version: ec2LaunchTemplate.attrLatestVersionNumber,
        launchTemplateId: ec2LaunchTemplate.attrLaunchTemplateId,
      },
      targetGroupArns: [cfnTargetGroup.attrTargetGroupArn],
      vpcZoneIdentifier: ["subnet-064036dc43f0e4a5e","subnet-0a77deb62508bf083"],
    });
    
    const cfnScalingPolicy = new autoscaling.CfnScalingPolicy(this, 'MyCfnScalingPolicy', {
      autoScalingGroupName: cfnAutoScalingGroup.ref,
      policyType: 'TargetTrackingScaling',
      targetTrackingConfiguration: {
        targetValue: 60,
        disableScaleIn: false,
        predefinedMetricSpecification: {
          predefinedMetricType: 'ASGAverageCPUUtilization',
        },
      },
    });

    
    



  }
}
