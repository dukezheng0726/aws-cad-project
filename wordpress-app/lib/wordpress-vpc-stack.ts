import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ssm from 'aws-cdk-lib/aws-ssm';

// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class WordpressVpcStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const CustomVPC = new ec2.Vpc(this, 'CustomVPC', {
      ipAddresses: ec2.IpAddresses.cidr('10.50.0.0/16'),
      createInternetGateway: true
    })

    new cdk.CfnOutput(this, 'CustomVPCIDOutput',{
      value: CustomVPC.vpcId,
      exportName: 'Application-VPC-ID',
    });

    const publicSubnets = CustomVPC.publicSubnets;

    new cdk.CfnOutput(this, 'PublicSubnetID1Output', {
      value: publicSubnets[0].subnetId,
      exportName: 'Public-Subnet1-ID',
    });

    new cdk.CfnOutput(this, 'PublicSubnetID2Output', {
      value: publicSubnets[1].subnetId,
      exportName: 'Public-Subnet2-ID',
    });

    const privateSubnets = CustomVPC.privateSubnets;

    new cdk.CfnOutput(this, 'PrivateSubnetID1Output', {
      value: privateSubnets[0].subnetId,
      exportName: 'Private-Subnet1-ID',
    });

    new cdk.CfnOutput(this, 'PrivateSubnetID2Output', {
      value: privateSubnets[1].subnetId,
      exportName: 'Private-Subnet2-ID',
    });
 
    const publicSubnetIds = CustomVPC.publicSubnets.map(subnet => subnet.subnetId);
    // Output the public subnet IDs
    new cdk.CfnOutput(this, 'CustomVPCPublicSubnetIds', {
      value: JSON.stringify(publicSubnetIds),
      exportName: 'Application-PUBLIC-SUBNET-IDS',
    });
    
  // Security Group - ALB 
   const albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc: CustomVPC 
   });

   albSecurityGroup.addIngressRule( 
     ec2.Peer.ipv4('0.0.0.0/0'), 
     ec2.Port.tcp(80), 
   );
   
   albSecurityGroup.addIngressRule( 
     ec2.Peer.ipv4('0.0.0.0/0'), 
     ec2.Port.tcp(443), 
   );    

   new cdk.CfnOutput(this, 'ALBSGOutput',{
    value: albSecurityGroup.securityGroupId,
    exportName: 'Application-ALB-SG-ID',
   });
    
  // Security Group – EC2 
   const ec2SecurityGroup = new ec2.SecurityGroup(this, 'EC2SecurityGroup', {
      vpc: CustomVPC 
   });

   ec2SecurityGroup.addIngressRule( 
     ec2.Peer.ipv4('0.0.0.0/0'), 
     ec2.Port.tcp(22), 
   );

   ec2SecurityGroup.addIngressRule( 
    albSecurityGroup,
    ec2.Port.tcp(80), 
  );
   
  ec2SecurityGroup.addIngressRule( 
    albSecurityGroup,
    ec2.Port.tcp(443), 
  );
  
  new cdk.CfnOutput(this, 'EC2SGOutput',{
    value: ec2SecurityGroup.securityGroupId,
    exportName: 'Application-EC2-SG-ID',
  });


  // Security Group – RDS 
   const rdsSecurityGroup = new ec2.SecurityGroup(this, 'RDSSecurityGroup', {
      vpc: CustomVPC 
   });

   rdsSecurityGroup.addIngressRule( 
    ec2SecurityGroup,
    ec2.Port.tcp(3306), 
   );

   new cdk.CfnOutput(this, 'rdsSGOutput',{
    value: rdsSecurityGroup.securityGroupId,
    exportName: 'Application-RDS-SG-ID',
   });

    
    // Security Group - RDS-subnet-group 
    const rdsSubnetGroup = new rds.SubnetGroup(this, 'RDSSubnetGroup', {
      description: 'RDS subnet group',
      vpc: CustomVPC,
    
      // the properties below are optional
      subnetGroupName: 'RDS-SUBNET-GROUP',
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    new cdk.CfnOutput(this, 'rdsSubnetGroupOutput',{
      value: rdsSubnetGroup.subnetGroupName,
      exportName: 'Application-RDS-SubnetGroup-ID',
    });
  }
}
