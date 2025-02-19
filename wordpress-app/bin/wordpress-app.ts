#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { WordpressAppStack } from '../lib/wordpress-app-stack';
import { WordpressVpcStack } from '../lib/wordpress-vpc-stack';



const app = new cdk.App();

const deployment = { "stack":"V"}

if ( ["V"].includes(deployment.stack)) {
  new WordpressVpcStack(app, 'WordpressVpcStack', {

  });
}

if ( ["A"].includes(deployment.stack)) {
  new WordpressAppStack(app, 'WordpressAppStack', {

  });
}
